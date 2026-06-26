const { execSync } = require('child_process');

// Define specific PR numbers that we merged directly or don't want to leave hanging.
// Note: GitHub doesn't allow "closing" via gh pr close without auth, but we can write a script 
// that will run using `gh api` if we had permissions. Since we don't, I won't run this.
