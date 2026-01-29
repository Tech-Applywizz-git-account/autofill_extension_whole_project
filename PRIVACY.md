# Privacy Policy for Auto Apply - Job Application Autofill Extension

**Last Updated:** January 19, 2026

## Introduction

Auto Apply is a Chrome browser extension designed to help job seekers streamline their application process by intelligently autofilling job application forms. This Privacy Policy explains how we collect, use, store, and protect your personal information.

## Information We Collect

### User-Provided Information
When you use Auto Apply, you voluntarily provide the following information:

- **Personal Information**: First name, last name, preferred name, email address, phone number
- **Location Information**: City, state, country, postal code
- **Professional Information**: LinkedIn profile URL, GitHub profile URL, portfolio links
- **Education History**: School names, degrees, majors, GPAs, dates of attendance
- **Work Experience**: Job titles, company names, employment dates, locations, job responsibilities
- **Skills**: Professional and technical skills
- **Documents**: Resume (PDF), Cover Letter (PDF) - stored as base64-encoded data
- **Work Authorization**: US work authorization status, sponsorship requirements, citizenship status, driver's license status
- **Equal Employment Opportunity (EEO) Data**: Gender, race, veteran status, disability status (Note: This information is optional and only shared with potential employers as required by their application forms)

### Automatically Collected Information
- **Application Patterns**: Question and answer mappings learned from your job application interactions
- **Usage Data**: Which fields were autofilled, success rates, and performance metrics
- **Browser Storage**: Your profile and preferences are stored locally in Chrome's storage

## How We Use Your Information

We use your information solely for the following purposes:

1. **Autofilling Job Applications**: To automatically populate job application forms with your information
2. **AI-Powered Predictions**: To use AI (AWS Bedrock) to intelligently answer application questions based on your profile
3. **Pattern Learning**: To improve autofill accuracy by learning from your application patterns
4. **Profile Management**: To save and sync your profile data across browser sessions

## How We Store Your Information

### Local Storage
- Your profile data is primarily stored **locally** in your Chrome browser using Chrome's Storage API
- Documents (resume, cover letter) are stored as base64-encoded strings in local storage

### Cloud Storage
- Your profile and learned patterns may be synced to our backend service hosted on Render.com
- All data transmitted to our servers is sent over **HTTPS** (encrypted connections)
- We store your data on secure servers protected by industry-standard security measures

### AI Processing
- When AI prediction is needed, your question and relevant profile information are sent to **AWS Bedrock** (Amazon's AI service)
- AWS processes this data according to [AWS Privacy Policy](https://aws.amazon.com/privacy/)
- We do not store your data permanently in AWS; it is only used for real-time predictions

## Data Sharing and Disclosure

We **DO NOT** sell, rent, or trade your personal information to third parties.

We only share your information in the following limited circumstances:

1. **Job Application Websites**: When you use the autofill feature, your data is entered into the job application forms on third-party websites (e.g., Greenhouse, Lever, Workday). This is the primary purpose of the extension.

2. **AI Service Provider (AWS Bedrock)**: Profile data is sent to AWS Bedrock for AI-powered answer prediction. AWS processes this data under their own privacy policy.

3. **Legal Requirements**: We may disclose your information if required by law, court order, or government regulation.

## Data Retention

- **Profile Data**: Stored until you manually delete it or uninstall the extension
- **Learned Patterns**: Stored until you clear your pattern history or uninstall the extension
- **Backend Data**: Retained for as long as your account is active; can be deleted upon request

## Your Rights and Choices

You have the following rights regarding your data:

### Access and Update
- You can view and edit your profile at any time through the extension's onboarding/settings page

### Delete
- **Local Data**: Clear extension data via Chrome settings (Extensions → Auto Apply → Remove extension)
- **Backend Data**: Contact us to request deletion of your data from our servers

### Opt-Out
- You can disable AI predictions by not providing AWS credentials
- You can disable pattern learning by clearing learned patterns in the extension settings

### Export
- You can export your profile data by accessing Chrome's local storage

## Security Measures

We implement the following security measures:

- **HTTPS Encryption**: All data transmitted to our backend is encrypted using HTTPS
- **Chrome Security**: We use Chrome's secure storage APIs
- **No Plaintext Passwords**: We do not store any passwords or sensitive authentication credentials in plaintext
- **Access Controls**: Backend access is restricted and monitored

However, no method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.

## Permissions Justification

Our extension requires the following Chrome permissions:

- **`storage`**: To save your profile and preferences locally
- **`activeTab`**: To detect job application pages and autofill forms
- **`scripting`**: To inject autofill logic into job application pages
- **`tabs`**: To monitor active job application tabs

## Third-Party Services

We use the following third-party services:

1. **AWS Bedrock** (Amazon Nova AI) - AI-powered answer prediction
   - [AWS Privacy Policy](https://aws.amazon.com/privacy/)

2. **Render.com** - Backend hosting for profile and pattern storage
   - [Render Privacy Policy](https://render.com/privacy)

3. **Vercel** - CRM data fetching (optional)
   - [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy)

## Children's Privacy

This extension is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by:
- Updating the "Last Updated" date at the top of this policy
- Displaying a notification in the extension (for material changes)

Your continued use of the extension after changes constitutes acceptance of the updated policy.

## Contact Us

If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please contact us:

- **Email**: apply@gmail.com
- **GitHub**: https://github.com/Tech-Applywizz-git-account/only_ai-service_folder_autofill_extesnion

## Data Controller

The data controller responsible for your personal information is:
- **Organization**: ApplyWizz / Auto Apply Extension
- **Contact Email**: apply@gmail.com

## Your Consent

By using Auto Apply, you consent to this Privacy Policy and agree to its terms.

---

**This privacy policy is effective as of January 19, 2026.**