# GitHub Setup Guide for Lucky Map

## Step 1: Create a New Repository on GitHub

1. Go to [GitHub](https://github.com) and sign in
2. Click the **+** icon in the top right corner
3. Select **New repository**
4. Fill in the repository details:
   - **Repository name**: `luckymap` (or your preferred name)
   - **Description**: "Interactive map application with business markers and Google Maps integration"
   - **Visibility**: Select **Public**
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click **Create repository**

## Step 2: Connect Your Local Repository to GitHub

After creating the repository, GitHub will show you a page with setup instructions. Follow the section **"…or push an existing repository from the command line"**.

Run these commands in your terminal:

```bash
# Add the remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/luckymap.git

# Verify the remote was added
git remote -v

# Push your code to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Verify Your Repository

1. Refresh your GitHub repository page
2. You should see all your files uploaded
3. The commit message "Initial commit: Lucky Map application" should be visible

## Important Files Already Committed

✅ `.gitignore` - Prevents sensitive files from being uploaded
✅ `package.json` - Project dependencies
✅ `server.js` - Backend server code
✅ `index.html` - Frontend interface
✅ `DEPLOYMENT_GUIDE.md` - Deployment instructions

## Files Excluded (Not Uploaded)

🔒 `node_modules/` - Dependencies (others will run `npm install`)
🔒 `.DS_Store` - Mac OS system file
🔒 `solstice-compact.json` - Credential file (kept private)
🔒 `.env` files - Environment variables (if any)

## Next Steps After Pushing

1. **Add a README**: Create a README.md to describe your project
2. **Environment Variables**: Add instructions for setting up API keys
3. **Collaborators**: Invite team members if needed (Settings → Collaborators)
4. **Branch Protection**: Consider protecting the main branch (Settings → Branches)

## Common Commands for Future Updates

```bash
# Check status
git status

# Stage changes
git add .

# Commit changes
git commit -m "Description of changes"

# Push to GitHub
git push

# Pull latest changes
git pull
```

## Troubleshooting

**If push fails with authentication error:**
- GitHub no longer accepts passwords for git operations
- You need to use a Personal Access Token or SSH key
- Generate token: Settings → Developer settings → Personal access tokens → Generate new token
- Use the token instead of your password when prompted

**If you need to change the remote URL:**
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/luckymap.git
```

## Security Reminders

⚠️ **NEVER commit:**
- API keys or secrets
- Firebase credentials
- Database passwords
- `.env` files with sensitive data

All sensitive information should be stored in environment variables or secure configuration management systems.
