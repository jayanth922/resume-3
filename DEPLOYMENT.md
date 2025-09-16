# Deployment Guide

## GitHub Setup

### Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right → "New repository"
3. **Repository name**: `flagship-feature-flags`
4. **Description**: `Enterprise feature flag platform with Bayesian A/B testing`
5. **Visibility**: Public (to showcase for recruiters)
6. **DO NOT** initialize with README (we already have one)
7. Click "Create repository"

### Step 2: Connect Local Repository

```bash
# Add GitHub as remote origin (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/flagship-feature-flags.git

# Push code to GitHub
git branch -M main
git push -u origin main
```

## Vercel Deployment

### Step 1: Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "New Project"
3. Import your `flagship-feature-flags` repository
4. Keep all default settings
5. Click "Deploy"

### Step 2: Add Environment Variables

In Vercel dashboard → Project → Settings → Environment Variables, add:

```env
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
ADMIN_SECRET=your-secure-admin-secret
```

### Step 3: Set Up Databases

#### Neon PostgreSQL:
1. Go to [neon.tech](https://neon.tech) → Create account
2. Create new project → Copy connection string
3. Add to Vercel as `DATABASE_URL`

#### Upstash Redis:
1. Go to [upstash.com](https://upstash.com) → Create account  
2. Create Redis database → Copy REST URL and token
3. Add to Vercel as `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### Step 4: Deploy Database Schema

After adding environment variables:

1. Go to Vercel dashboard → Deployments
2. Trigger a new deployment (or push to GitHub)
3. In Vercel Functions tab, run a database migration:

```bash
# This will be done automatically via Prisma
npx prisma db push
```

### Step 5: Verify Deployment

1. **Check deployment URL**: `https://your-app.vercel.app`
2. **Test admin dashboard**: Create a feature flag
3. **Test API**: `https://your-app.vercel.app/api/edge/flags?userKey=test`
4. **Test onboarding**: Register a new application

## Production Checklist

- [ ] GitHub repository is public and professional
- [ ] README displays correctly
- [ ] Vercel deployment is successful
- [ ] Database connections are working
- [ ] Redis cache is connected
- [ ] Feature flags can be created and evaluated
- [ ] Application registration works
- [ ] Edge API responds in <10ms
- [ ] Admin dashboard is accessible

## Troubleshooting

### Common Issues:

1. **Database connection fails**:
   - Verify DATABASE_URL format
   - Check Neon database is active
   - Ensure SSL mode is enabled

2. **Redis connection fails**:
   - Verify Upstash credentials
   - Check region compatibility

3. **Build fails**:
   - Check for TypeScript errors
   - Verify all dependencies are installed

### Support:
- Check deployment logs in Vercel dashboard
- Review function logs for API errors
- Test locally first with `npm run dev`