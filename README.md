# Job Application Autofill Extension

A production-grade Chrome Extension that intelligently autofills job applications using deterministic canonical mapping, AI only as a last resort, with strict safety and consent requirements.

## Features

- ✅ **Smart Field Detection**: Detects form fields across Workday, Greenhouse, Lever, iCIMS, and more
- ✅ **Deterministic Mapping**: Rule-based intent detection with confidence scoring
- ✅ **Safety First**: Never infers EEO/protected fields, always uses explicit profile values
- ✅ **Transparency**: UI panel shows what's filled, skipped, and why
- ✅ **User Control**: Profile is immutable unless user edits it

## Architecture

### Extension (Chrome MV3)
- **Content Script**: Scans DOM, detects fields, maps to canonical intents, autofills
- **Background Worker**: Manages lifecycle, opens onboarding on first install
- **Settings Page**: Edit profile, export/import JSON

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Extension
```bash
# Development build with watch
npm run dev

# Production build
npm run build
```

### 3. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder within this directory

## Usage

1. Navigate to any job application site (Workday, Greenhouse, Lever, etc.)
2. Extension automatically detects form fields
3. Fields are filled based on your canonical profile
4. UI panel shows completion status and field-by-field breakdown
5. Click on any field in the panel to focus it for manual review

## Project Structure

```
extension/
├── src/
│   ├── types/           # TypeScript type definitions
│   ├── core/
│   │   ├── mapping/     # Intent detection, enum matching
│   │   ├── resolution/  # Value resolution from profile
│   │   └── storage/     # Chrome storage wrapper
│   ├── content/
│   │   ├── fieldDetection/  # DOM/ARIA field scanning
│   │   ├── actions/         # Form interaction (fill, click, select)
│   │   └── ui/              # React overlay panel
│   ├── pages/
│   │   ├── onboarding/  # Onboarding wizard
│   │   └── settings/    # Settings page
│   └── background/      # Service worker
├── manifest.json
├── package.json
└── webpack.config.js
```

## Safety & Consent

### Non-Negotiable Rules

1. **NO inference** of demographic or legal/compliance fields from resume
2. **NEVER use AI** for: work authorization, visa, gender, race, ethnicity, disability, veteran, LGBTQ+, sexual orientation, DOB, SSN
3. **Only use values** explicitly stored in user's canonical profile
4. **Default to "Decline to state"** for all EEO fields
5. **Skip when unsure** - never guess or hallucinate

### Consent

- User must explicitly agree to autofill consent during onboarding
- Profile is immutable unless user edits it in settings
- User can export/import profile JSON for backup

## Supported Portals

- Workday (custom dropdowns, multi-step forms)
- Greenhouse (native inputs/selects)
- Lever (custom fields)
- iCIMS (mixed controls)
- SmartRecruiters
- Generic job application forms

## Development

### Adding New Field Intents

1. Add new canonical intent to `src/core/mapping/intentDictionary.ts`
2. Add regex patterns for detection
3. Mark as `isProtected` if it's an EEO/sensitive field
4. Update profile schema in `src/types/canonicalProfile.ts` if needed

## Limitations

- Cannot access closed shadow DOM
- Some heavily obfuscated sites may require custom handling
- AI fallback is NOT implemented for non-sensitive free-text (optional feature)

## License

Personal use only.

## Credits

Built following Jobright-style deterministic autofill principles with strict safety gating.
