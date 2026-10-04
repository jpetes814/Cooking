# One-time setup

Goal: get Recipe Box live on a real URL, on your phone, with building-from-your-phone switched on. These are the steps only a person can do in a browser. You don't need all of it on day one: section 1 and 4 get the app on your phone, and the rest arrives with the step that needs it.

## Cost

- **Free:** Vercel (Hobby plan), GitHub Actions (free minutes cover this easily), Firebase sign-in and database (Spark plan).
- **Pennies:** recipe photos need Firebase Storage, which needs the pay-as-you-go **Blaze** plan. A few hundred shrunk photos is well inside the free allowance, so expect $0. Set a budget alert anyway (section 3).
- **Pay as you go:** the Claude API. About a cent or two each time Claude reads a caption or photo, and $0.50 to $2 per change Claude builds from a GitHub issue. A spend limit caps it. Recipe websites fill in for free, with no AI.

## 1. GitHub repo settings

1. **Claude GitHub App:** go to github.com/apps/claude, tap **Configure**, and make sure this repo is in the list.
2. **Merging:** **Settings > General > Pull Requests**: allow **squash merging** only, and turn on **Automatically delete head branches**.
3. **Protect `main`:** **Settings > Rules > Rulesets > New branch ruleset**. Target the default branch. Turn on **Require a pull request before merging** (0 approvals), **Require status checks to pass** (add `checks` and `e2e` once CI has run once), and **Block force pushes**.
4. **If the repo is public:** **Settings > Moderation options > Interaction limits**: limit to repository collaborators, so strangers can't trigger @claude runs on your key.

## 2. Claude API keys

1. At console.anthropic.com, create a workspace called `recipe-box` and set a **monthly spend limit** (start with $10).
2. Create two API keys in that workspace: `recipe-box-app` (for Vercel) and `recipe-box-github` (for the @claude Action).
3. In the repo: **Settings > Secrets and variables > Actions > New repository secret**. Name `ANTHROPIC_API_KEY`, value the `recipe-box-github` key.

## 3. Firebase (sign-in, data, photos)

Needed from the sign-in step on. Make **two** projects, so test previews never touch your real recipes.

1. At console.firebase.google.com, **Add project**: `recipe-box`. Skip Google Analytics.
2. **Build > Authentication > Get started > Email/Password**: turn it on (leave "email link" off).
3. **Authentication > Users > Add user**: add your email with a password. There's no sign-up screen in the app on purpose.
4. **Build > Firestore Database > Create database**: pick a location near you, start in **production mode**.
5. **Security rules:** open `firestore.rules` in this repo, copy all of it, then in Firebase go to **Firestore Database > Rules**, replace everything there with it, and tap **Publish**. Do this again whenever that file changes (the pull request will say so).
6. **The allowlist:** **Firestore Database > Data > Start collection**. Collection ID `config`, document ID `allowlist`, field `emails` of type **array** with your email as a lowercase string.
7. **Project settings (gear icon) > Your apps > Web (`</>`)**: register an app called `recipe-box`. Copy the `apiKey`, `authDomain`, `projectId`, `appId`, and `storageBucket` values for Vercel below.
8. **Photos (from the photos step):** upgrade to **Blaze** (bottom-left **Upgrade**), then in Google Cloud **Billing > Budgets & alerts** add a $5 budget with email alerts. Then **Build > Storage > Get started**, production mode, and paste `storage.rules` into **Storage > Rules** the same way as step 5.
9. Repeat 1 to 8 for a second project called `recipe-box-test`.

## 4. Vercel (hosting)

1. At vercel.com, sign in with GitHub. **Add New > Project**, import this repo. Leave the build settings as detected.
2. **Deploy.** You'll get a URL like `https://recipe-box-xyz.vercel.app`. Every pull request also gets its own **preview** link, which is how you test changes on your phone.
3. **Settings > Deployment Protection**: turn **Vercel Authentication** off, so preview links open on your phone without a Vercel login. The app's own sign-in protects your data.
4. **Environment Variables** (from the sign-in step on). Add each one with the right environment ticked:

   | Name | Production | Preview |
   |---|---|---|
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | from `recipe-box` | from `recipe-box-test` |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | from `recipe-box` | from `recipe-box-test` |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | from `recipe-box` | from `recipe-box-test` |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | from `recipe-box` | from `recipe-box-test` |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | from `recipe-box` | from `recipe-box-test` |
   | `ALLOWED_EMAILS` | your email | same |
   | `ANTHROPIC_API_KEY` | `recipe-box-app` key | same key |
   | `YOUTUBE_API_KEY` (optional, section 6) | your key | same key |

   After changing variables, redeploy (**Deployments > ... > Redeploy**).

## 5. Install on your phone

1. Open the production URL. iPhone: **Safari**. Android: **Chrome**.
2. iPhone: Share button > **Add to Home Screen**. Android: menu > **Install app**.
3. Open it from the home-screen icon and sign in there (the installed app keeps its own sign-in, separate from the browser).
4. Open it once with signal so your recipes are saved for offline.

## 6. Optional: YouTube descriptions

"Fill from link" reads a YouTube video's title on its own, but recipes usually live in the description, which needs a free Google key.

1. At console.cloud.google.com, create a project (or reuse one), then **APIs & Services > Library**, search **YouTube Data API v3**, and tap **Enable**.
2. **APIs & Services > Credentials > Create credentials > API key**. Tap the new key, then under **API restrictions** pick **Restrict key** and choose **YouTube Data API v3**.
3. Add it to Vercel as `YOUTUBE_API_KEY` for Production and Preview, then redeploy.

The free daily allowance is far more than one person will use.
