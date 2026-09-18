# Notion Week Calendar

A secure Vercel-hosted week view for Marta's Notion Tasks data source. It reads tasks by `Date` and writes checkbox changes to both `did?` and `status` (`TO DO` / `DONE`).

## Deploy to Vercel

1. Create a Notion internal integration at https://www.notion.so/profile/integrations and copy its secret.
2. Open the Tasks database in Notion, choose **••• → Connections**, and add that integration.
3. Upload this project to a Git repository and import it at https://vercel.com/new, or deploy it with the Vercel CLI.
4. Add these Vercel environment variables for Production, Preview, and Development:
   - `NOTION_API_TOKEN`: the Notion integration secret.
   - `NOTION_DATA_SOURCE_ID`: `48a7005e-e796-831a-be80-071072832343`
   - `CALENDAR_ACCESS_KEY`: a strong private password of your choice.
5. Redeploy, open the Vercel URL, and enter the calendar access key.
6. In Notion, paste the Vercel URL and choose **Create embed**.

## Security

The Notion token is used only inside Vercel Functions and is never sent to the browser. The access key prevents anyone who happens to obtain the deployment URL from reading or changing tasks. For a higher-security multi-user deployment, replace the shared key with an identity provider.

## Expected Notion schema

- `Name` — title
- `Date` — date
- `did?` — checkbox
- `status` — status containing exact options `TO DO` and `DONE`
