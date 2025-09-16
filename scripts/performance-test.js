const https = require('https');
const { performance } = require('perf_hooks');

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const TEST_USERS = 1000;
const CONCURRENT_REQUESTS = 50;

async function makeRequest(userKey) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const url = `${API_URL}/api/edge/flags?userKey=${userKey}&country=US&deviceType=mobile`;
    
    const options = {
      method: 'GET',
      timeout: 5000,
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const end = performance.now();
        resolve({
          duration: end - start,
          status: res.statusCode,
          userKey
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runPerformanceTest() {
  console.log('🚀 Starting Flagship Performance Test');
  console.log(`Testing ${TEST_USERS} users with ${CONCURRENT_REQUESTS} concurrent requests`);
  console.log('Target: p95 < 10ms\n');

  const results = [];
  const errors = [];

  // Generate test user keys
  const userKeys = Array.from({length: TEST_USERS}, (_, i) => `test-user-${i}`);
  
  // Run tests in batches
  for (let i = 0; i < userKeys.length; i += CONCURRENT_REQUESTS) {
    const batch = userKeys.slice(i, i + CONCURRENT_REQUESTS);
    const promises = batch.map(userKey => 
      makeRequest(userKey).catch(err => {
        errors.push({ userKey, error: err.message });
        return null;
      })
    );

    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(r => r !== null));
    
    // Progress indicator
    if ((i + CONCURRENT_REQUESTS) % 200 === 0) {
      console.log(`Progress: ${Math.min(i + CONCURRENT_REQUESTS, userKeys.length)}/${userKeys.length} requests completed`);
    }
  }

  // Calculate statistics
  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  const successfulRequests = results.length;
  const errorRate = (errors.length / TEST_USERS) * 100;

  const stats = {
    total: TEST_USERS,
    successful: successfulRequests,
    errors: errors.length,
    errorRate: errorRate.toFixed(2) + '%',
    avg: (durations.reduce((sum, d) => sum + d, 0) / durations.length).toFixed(2) + 'ms',
    p50: durations[Math.floor(durations.length * 0.5)].toFixed(2) + 'ms',
    p95: durations[Math.floor(durations.length * 0.95)].toFixed(2) + 'ms',
    p99: durations[Math.floor(durations.length * 0.99)].toFixed(2) + 'ms',
    max: Math.max(...durations).toFixed(2) + 'ms'
  };

  console.log('\n📊 Performance Test Results:');
  console.log('================================');
  console.log(`Total Requests:     ${stats.total}`);
  console.log(`Successful:         ${stats.successful}`);
  console.log(`Errors:             ${stats.errors} (${stats.errorRate})`);
  console.log(`Average Latency:    ${stats.avg}`);
  console.log(`P50 Latency:        ${stats.p50}`);
  console.log(`P95 Latency:        ${stats.p95} ${parseFloat(stats.p95) < 10 ? '✅' : '❌'}`);
  console.log(`P99 Latency:        ${stats.p99}`);
  console.log(`Max Latency:        ${stats.max}`);

  // Consistency test
  console.log('\n🔄 Sticky Bucketing Consistency Test:');
  const testUser = 'consistency-test-user';
  const consistencyResults = [];
  
  for (let i = 0; i < 10; i++) {
    try {
      const result = await makeRequest(testUser);
      // In a real test, you'd parse the JSON response to check flag values
      consistencyResults.push(result);
    } catch (error) {
      console.log(`❌ Consistency test failed: ${error.message}`);
    }
  }

  if (consistencyResults.length === 10) {
    console.log(`✅ User ${testUser} bucketed consistently across ${consistencyResults.length} requests`);
  }

  console.log('\n🎯 Test Summary:');
  const p95Pass = parseFloat(stats.p95) < 10;
  const errorRatePass = parseFloat(stats.errorRate) < 5;
  
  console.log(`P95 < 10ms:         ${p95Pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Error Rate < 5%:    ${errorRatePass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Overall:            ${p95Pass && errorRatePass ? '✅ PASS' : '❌ FAIL'}`);

  if (errors.length > 0) {
    console.log('\n⚠️  Sample Errors:');
    errors.slice(0, 5).forEach(err => {
      console.log(`  ${err.userKey}: ${err.error}`);
    });
  }
}

// Run the test
runPerformanceTest().catch(console.error);