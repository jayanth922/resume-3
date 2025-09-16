import asyncio
import json
import time
import logging
from typing import Dict, Any, Optional, List
import aiohttp
import hashlib

class UserAttributes:
    def __init__(
        self,
        user_id: str,
        country: Optional[str] = None,
        device_type: Optional[str] = None,
        user_agent: Optional[str] = None,
        custom_properties: Optional[Dict[str, Any]] = None
    ):
        self.user_id = user_id
        self.country = country
        self.device_type = device_type
        self.user_agent = user_agent
        self.custom_properties = custom_properties or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            'userId': self.user_id,
            'country': self.country,
            'deviceType': self.device_type,
            'userAgent': self.user_agent,
            'customProperties': self.custom_properties
        }

class FlagEvaluationResult:
    def __init__(
        self,
        flag_key: str,
        variant: str,
        value: Any,
        is_active: bool,
        reason: str
    ):
        self.flag_key = flag_key
        self.variant = variant
        self.value = value
        self.is_active = is_active
        self.reason = reason

    def __repr__(self) -> str:
        return f"FlagEvaluationResult(flag_key='{self.flag_key}', variant='{self.variant}', value={self.value}, is_active={self.is_active})"

class FlagshipConfig:
    def __init__(
        self,
        api_url: str,
        refresh_interval: int = 60,
        enable_debug_logs: bool = False,
        timeout: int = 5
    ):
        self.api_url = api_url.rstrip('/')
        self.refresh_interval = refresh_interval
        self.enable_debug_logs = enable_debug_logs
        self.timeout = timeout

class FlagshipClient:
    def __init__(
        self,
        user_key: str,
        user_attributes: UserAttributes,
        config: FlagshipConfig
    ):
        self.user_key = user_key
        self.user_attributes = user_attributes
        self.config = config
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.session: Optional[aiohttp.ClientSession] = None
        self.refresh_task: Optional[asyncio.Task] = None
        
        # Setup logging
        if config.enable_debug_logs:
            logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger('flagship')

    async def __aenter__(self):
        """Async context manager entry"""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.stop()

    async def start(self):
        """Initialize the client"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.config.timeout)
        )
        
        if self.config.refresh_interval > 0:
            self.refresh_task = asyncio.create_task(self._periodic_refresh())
            self.log("Started periodic refresh")

    async def stop(self):
        """Stop the client and cleanup resources"""
        if self.refresh_task:
            self.refresh_task.cancel()
            try:
                await self.refresh_task
            except asyncio.CancelledError:
                pass

        if self.session:
            await self.session.close()
        
        self.cache.clear()
        self.log("Client stopped")

    async def get_flag(self, flag_key: str) -> FlagEvaluationResult:
        """Evaluate a feature flag for the current user"""
        # Check cache first
        cached = self._get_cached_flag(flag_key)
        if cached:
            self.log(f"Cache hit for flag: {flag_key}")
            return cached

        # Fetch from API
        self.log(f"Cache miss for flag: {flag_key}, fetching from API")
        return await self._fetch_and_cache_flag(flag_key)

    async def get_flags(self, flag_keys: Optional[List[str]] = None) -> Dict[str, FlagEvaluationResult]:
        """Get multiple flags at once"""
        params = {
            'userKey': self.user_key,
            'country': self.user_attributes.country or '',
            'deviceType': self.user_attributes.device_type or '',
            'customProperties': json.dumps(self.user_attributes.custom_properties)
        }

        if flag_keys:
            params['flagKeys'] = ','.join(flag_keys)

        headers = {}
        if self.user_attributes.user_agent:
            headers['User-Agent'] = self.user_attributes.user_agent

        try:
            if not self.session:
                raise RuntimeError("Client not started. Call start() first or use as async context manager.")

            url = f"{self.config.api_url}/api/edge/flags"
            async with self.session.get(url, params=params, headers=headers) as response:
                if response.status != 200:
                    raise aiohttp.ClientError(f"HTTP {response.status}: {response.reason}")
                
                data = await response.json()
                results = {}

                # Cache and return results
                for flag_data in data.get('flags', []):
                    flag_result = FlagEvaluationResult(
                        flag_key=flag_data['flagKey'],
                        variant=flag_data['variant'],
                        value=flag_data['value'],
                        is_active=flag_data['isActive'],
                        reason=flag_data['reason']
                    )
                    self._cache_flag(flag_data['flagKey'], flag_result)
                    results[flag_data['flagKey']] = flag_result

                self.log(f"Fetched {len(results)} flags from API")
                return results

        except Exception as error:
            self.log(f"Error fetching flags: {error}", level='error')
            return {}

    async def is_enabled(self, flag_key: str) -> bool:
        """Check if a boolean flag is enabled"""
        result = await self.get_flag(flag_key)
        return result.is_active and bool(result.value)

    async def get_variant(self, flag_key: str) -> Any:
        """Get the variant value for a flag"""
        result = await self.get_flag(flag_key)
        return result.value if result.is_active else None

    async def log_exposure(self, flag_key: str, variant: str) -> None:
        """Log an exposure event"""
        try:
            if not self.session:
                raise RuntimeError("Client not started")

            payload = {
                'userKey': self.user_key,
                'flagKey': flag_key,
                'variant': variant,
                'attributes': self.user_attributes.to_dict()
            }

            url = f"{self.config.api_url}/api/exposures"
            async with self.session.post(url, json=payload) as response:
                if response.status not in [200, 201]:
                    raise aiohttp.ClientError(f"HTTP {response.status}")

            self.log(f"Logged exposure: {flag_key} = {variant}")

        except Exception as error:
            self.log(f"Error logging exposure: {error}", level='error')

    def update_user_attributes(self, attributes: Dict[str, Any]) -> None:
        """Update user attributes"""
        for key, value in attributes.items():
            if hasattr(self.user_attributes, key):
                setattr(self.user_attributes, key, value)
            else:
                self.user_attributes.custom_properties[key] = value
        
        # Clear cache since user attributes changed
        self.cache.clear()
        self.log("User attributes updated, cache cleared")

    async def refresh(self) -> None:
        """Manually refresh all cached flags"""
        cached_keys = list(self.cache.keys())
        self.cache.clear()
        
        if cached_keys:
            await self.get_flags(cached_keys)
        
        self.log("Manual refresh completed")

    async def _fetch_and_cache_flag(self, flag_key: str) -> FlagEvaluationResult:
        """Fetch a single flag and cache it"""
        flags = await self.get_flags([flag_key])
        
        if flag_key in flags:
            # Auto-log exposure for active flags
            if flags[flag_key].is_active:
                asyncio.create_task(
                    self.log_exposure(flag_key, flags[flag_key].variant)
                )
            return flags[flag_key]

        # Return default if flag not found
        default_result = FlagEvaluationResult(
            flag_key=flag_key,
            variant='control',
            value=False,
            is_active=False,
            reason='flag_not_found'
        )

        self._cache_flag(flag_key, default_result)
        return default_result

    def _get_cached_flag(self, flag_key: str) -> Optional[FlagEvaluationResult]:
        """Get flag from cache if not expired"""
        cached = self.cache.get(flag_key)
        if not cached:
            return None

        now = time.time()
        if now > cached['timestamp'] + cached['ttl']:
            del self.cache[flag_key]
            return None

        return cached['result']

    def _cache_flag(self, flag_key: str, result: FlagEvaluationResult) -> None:
        """Cache a flag result"""
        self.cache[flag_key] = {
            'result': result,
            'timestamp': time.time(),
            'ttl': 300  # 5 minutes
        }

    async def _periodic_refresh(self) -> None:
        """Background task for periodic refresh"""
        while True:
            try:
                await asyncio.sleep(self.config.refresh_interval)
                await self.refresh()
            except asyncio.CancelledError:
                break
            except Exception as error:
                self.log(f"Periodic refresh failed: {error}", level='error')

    def log(self, message: str, level: str = 'info') -> None:
        """Log a message if debug logging is enabled"""
        if self.config.enable_debug_logs:
            if level == 'error':
                self.logger.error(f"[Flagship] {message}")
            else:
                self.logger.info(f"[Flagship] {message}")

# Factory function for easier usage
def create_flagship_client(
    user_key: str,
    user_attributes: UserAttributes,
    config: FlagshipConfig
) -> FlagshipClient:
    """Create a new Flagship client instance"""
    return FlagshipClient(user_key, user_attributes, config)

# Example usage
async def example_usage():
    """Example of how to use the Flagship Python SDK"""
    # Configure the client
    config = FlagshipConfig(
        api_url='http://localhost:3000',
        refresh_interval=60,
        enable_debug_logs=True
    )

    # Create user attributes
    user_attrs = UserAttributes(
        user_id='user-123',
        country='US',
        device_type='mobile',
        custom_properties={'plan': 'premium'}
    )

    # Use the client
    async with create_flagship_client('user-123', user_attrs, config) as client:
        # Check if a feature is enabled
        is_new_ui_enabled = await client.is_enabled('new-ui-design')
        print(f"New UI enabled: {is_new_ui_enabled}")

        # Get a variant value
        button_color = await client.get_variant('button-color')
        print(f"Button color: {button_color}")

        # Get multiple flags
        flags = await client.get_flags(['new-ui-design', 'button-color', 'premium-features'])
        for flag_key, result in flags.items():
            print(f"{flag_key}: {result}")

if __name__ == '__main__':
    # Run the example
    asyncio.run(example_usage())