# 🤖 Automated Image Processing System

## Overview

This system automatically processes new client images from Airtable using Cloudflare Cron Triggers. It runs on a schedule (every 6-24 hours) and processes images for any new records created in the last 24 hours.

## Features

✅ **Scheduled Processing** - Runs automatically every 6 or 24 hours  
✅ **Smart Filtering** - Only processes new records with images  
✅ **Configurable Prompts** - Combine default food photo prompt with client prompts  
✅ **Admin Control Panel** - Configure settings and manually trigger processing  
✅ **Processing History** - View detailed results and error logs  
✅ **Email Templates** - Generate ready-to-send emails (manual send)

## How It Works

### 1. Scheduled Check
Every 6-24 hours (configurable), the system:
- Fetches Airtable records from the last 24 hours
- Filters for records with `Order_Package` field
- Processes ALL images from both `Image_Upload` and `Image_Upload2` fields

### 2. Automatic Processing
For each qualifying record:
- Fetches images from BOTH `Image_Upload` (test images) and `Image_Upload2` (bundle images)
- Combines default prompt + client's custom prompt
- Processes images with AI (2 variations by default)
- Uploads results to R2
- Saves generated images to destination Airtable table (AIRTABLE_BASE_ID / AIRTABLE_TABLE_NAME)

### 3. Results Tracking
- Success/error counts
- Processing duration
- Detailed logs for each record
- Error messages for troubleshooting

## Quick Start

### 1. Add Environment Variables
See [AUTOMATION_SETUP.md](./AUTOMATION_SETUP.md) for complete list.

**Essential variables:**
```
AUTO_PROCESS_ENABLED=false  # Start with false for testing
DEFAULT_FOOD_PROMPT=Professional food photography, high quality, well-lit, appetizing presentation, restaurant quality
USE_DEFAULT_PROMPT=true
DEFAULT_VARIATION_COUNT=2
WORKER_URL=https://your-site.pages.dev
```

### 2. Test Manually
1. Navigate to `/admin-automation`
2. Configure your settings:
   - ✅ Enable default food prompt
   - Set variation count to 2
   - Choose schedule (6 or 24 hours)
3. Click "▶️ Run Now" to test
4. Review results

### 3. Enable Automation
Once testing is successful:
1. Set `AUTO_PROCESS_ENABLED=true`
2. Redeploy your application
3. Monitor first few automated runs

## Admin Control Panel

Access at: `/admin-automation`

### Configuration Section
- **Enable/Disable Automation** - Master switch
- **Processing Schedule** - Every 6 or 24 hours
- **Variations per Image** - 1, 2, or 4 variations
- **Default Food Prompt** - Checkbox to enable/disable
- **Prompt Text** - Customizable default prompt

### Manual Control
- **Run Now** button - Manually trigger processing
- **Last Run** timestamp - See when it last ran
- Processing status indicator

### Processing Results
- Records found/processed counts
- Success/error statistics
- Processing duration
- Detailed breakdown per record
- Error logs

## Prompt System

### How Prompts Work

**With Default Prompt Enabled:**
```
Final Prompt = DEFAULT_FOOD_PROMPT + Client Prompt
```

**Example:**
- Default: "Professional food photography, high quality, well-lit, appetizing presentation"
- Client: "Make colors more vibrant and add warm tone"
- **Final**: "Professional food photography, high quality, well-lit, appetizing presentation. Make colors more vibrant and add warm tone"

**With Default Prompt Disabled:**
```
Final Prompt = Client Prompt only
```

### Best Practices
- Keep default prompt general and applicable to all food photos
- Let clients add specific modifications in their prompts
- Test different default prompts to find what works best
- Use checkbox to quickly toggle for special cases

## Cron Schedule

### Configuration
Edit `wrangler.toml` to change schedule:

```toml
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours
```

### Common Schedules
- Every 6 hours: `"0 */6 * * *"`
- Every 12 hours: `"0 */12 * * *"`
- Every 24 hours (midnight UTC): `"0 0 * * *"`
- Twice daily (9 AM & 9 PM UTC): `"0 9,21 * * *"`

Use [crontab.guru](https://crontab.guru/) to create custom schedules.

## Monitoring

### Cloudflare Dashboard
1. Go to Workers & Pages
2. Select your project
3. Click "Logs" tab
4. View real-time execution logs

### Admin UI
1. Visit `/admin-automation`
2. Click "Run Now" to see immediate results
3. Review processing details
4. Check error logs if any failures

## Troubleshooting

### No Records Being Processed

**Check:**
- Records exist in Airtable from last 24 hours
- Records have `Order_Package` field filled
- Records have images in `Image_Upload` and/or `Image_Upload2`

**Solution:**
- Review Airtable filter formula in `scheduled-processor.js`
- Check Cloudflare logs for filter results

### Processing Errors

**Common Issues:**
- Missing environment variables
- R2 bucket permissions
- AI endpoint timeout
- Airtable API rate limits

**Solution:**
- Check Cloudflare Workers logs for specific errors
- Verify all environment variables are set
- Test manually via `/admin-automation` first

### Automation Not Running

**Check:**
- `AUTO_PROCESS_ENABLED=true`
- Cron trigger configured in `wrangler.toml`
- Application redeployed after changes

**Solution:**
- Redeploy application
- Check Cloudflare cron trigger logs
- Use manual trigger to test

## Email Templates (Future Feature)

Currently, the system processes images automatically but does not send emails. Email template generation is prepared for future implementation.

**Planned features:**
- Auto-generate email with download links
- Store emails in Airtable for review
- Manual send button in admin UI
- Bulk send option

## File Structure

```
functions/
  └── scheduled-processor.js    # Cron trigger worker
src/
  └── pages/
      └── AdminAutomation.jsx   # Admin control panel
AUTOMATION_SETUP.md             # Environment variables guide
AUTOMATION_README.md            # This file
```

## Security Notes

⚠️ **Important:**
- Admin UI (`/admin-automation`) should be password-protected in production
- Consider adding authentication before enabling automation
- Monitor processing logs regularly
- Set up alerts for high error rates

## Support

For issues or questions:
1. Check Cloudflare Workers logs
2. Review processing results in admin UI
3. Verify environment variables
4. Test manually before enabling automation

---

**Version:** 1.0  
**Last Updated:** 2025-12-06


## Exampör Download Link
 https://upload-images-nano-banana-auto-full-7.pages.dev/?email=martin_wrede@web.de