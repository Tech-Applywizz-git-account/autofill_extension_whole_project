/**
 * QuestionMapper - Maps scanned questions to answers
 * Uses canonical matching, learned patterns, fuzzy matching, and AI fallback
 */

import { loadProfile } from '../../core/storage/profileStorage';
import { askAI } from '../../core/ai/aiService';
import { patternStorage } from '../../core/storage/patternStorage';

export interface ScannedQuestion {
    questionText: string;
    fieldType: string;
    options: string[] | undefined;
    required: boolean;
    selector: string;
}

export interface MappedAnswer {
    selector: string;
    questionText: string;
    answer: string;
    source: 'canonical' | 'learned' | 'fuzzy' | 'AI';
    confidence: number;
    required: boolean;
    fieldType: string;
    canonicalKey?: string;
    options?: string[];
    fileName?: string; // For file uploads - the original filename
}

export class QuestionMapper {

    /**
     * Process all scanned questions and return fill plan
     */
    async processQuestions(questions: ScannedQuestion[]): Promise<MappedAnswer[]> {
        console.log(`\n╔════════════════════════════════════════════════════════════════════╗`);
        console.log(`║             📋 SCANNED QUESTIONS (Total: ${questions.length})${' '.repeat(Math.max(0, 24 - questions.length.toString().length))}║`);
        console.log(`╚════════════════════════════════════════════════════════════════════╝\n`);

        questions.forEach((q, index) => {
            console.log(`\n┌─ Question #${index + 1} ${'─'.repeat(55 - (index + 1).toString().length)}`);
            console.log(`│ 📝 Text: "${q.questionText}"`);
            console.log(`│ 🏷️  Type: ${q.fieldType}`);
            console.log(`│ ${q.required ? '⚠️  Required: YES' : '✓  Required: NO'}`);
            if (q.options && q.options.length > 0) {
                console.log(`│ 🎯 Options (${q.options.length}): [${q.options.slice(0, 5).join(', ')}${q.options.length > 5 ? `, ... +${q.options.length - 5} more` : ''}]`);
            } else {
                console.log(`│ 📄 Options: None (free text field)`);
            }
            console.log(`│ 🎯 Selector: ${q.selector}`);
            console.log(`└${'─'.repeat(66)}`);
        });

        // Remove duplicates
        const uniqueQuestions = this.removeDuplicates(questions);
        if (uniqueQuestions.length < questions.length) {
            console.log(`\n🔄 Removed ${questions.length - uniqueQuestions.length} duplicate question(s)`);
            console.log(`📊  Processing ${uniqueQuestions.length} unique questions\n`);
        } else {
            console.log(`\n✓ All ${questions.length} questions are unique\n`);
        }

        console.log(`\n╔════════════════════════════════════════════════════════════════════╗`);
        console.log(`║                    🔍 STARTING MAPPING PROCESS                     ║`);
        console.log(`╚════════════════════════════════════════════════════════════════════╝\n`);

        const profile = await loadProfile();
        if (!profile) {
            throw new Error('No profile found. Please complete onboarding.');
        }

        const mappedAnswers: MappedAnswer[] = [];
        const unmappedForAI: ScannedQuestion[] = [];

        console.log(`🚀 Phase 1: Attempting canonical, learned pattern, and fuzzy matching...\n`);

        // Phase 1: Try canonical, learned, then fuzzy matching
        for (const q of uniqueQuestions) {
            console.log(`\n  🔍 Mapping: "${q.questionText}"`);
            const result = await this.tryMapping(q, profile);

            // Lower threshold to 0.6 (60%) to use learned patterns
            // Learned patterns typically have 60-95% confidence
            if (result && result.confidence >= 0.6) {
                // Confidence is good enough - use this answer
                mappedAnswers.push({
                    selector: q.selector,
                    questionText: q.questionText,
                    answer: result.answer,
                    source: result.source as any,
                    confidence: result.confidence,
                    required: q.required,
                    fieldType: q.fieldType,
                    options: q.options || undefined,
                    fileName: result.fileName // Include fileName if present
                });

                const sourceIcon = result.source === 'canonical' ? '🎯' : result.source === 'learned' ? '🧠' : '🔍';
                console.log(`     ${sourceIcon} ✅ Mapped via ${result.source.toUpperCase()}: "${result.answer}" (${(result.confidence * 100).toFixed(0)}% confidence)`);
            } else {
                // Low confidence or no match - queue for AI
                unmappedForAI.push(q);
                console.log(`     ⏭️  ⚠️ No match - Queued for AI (confidence: ${result ? (result.confidence * 100).toFixed(0) + '%' : 'N/A'})`);
            }
        }

        // Phase 2: Send unmapped questions to AI and LEARN from responses
        console.log(`\n\n╔════════════════════════════════════════════════════════════════════╗`);
        console.log(`║                Phase 1 Complete: ${mappedAnswers.length}/${uniqueQuestions.length} Mapped${' '.repeat(Math.max(0, 24 - mappedAnswers.length.toString().length - uniqueQuestions.length.toString().length))}║`);
        console.log(`╚════════════════════════════════════════════════════════════════════╝\n`);

        if (unmappedForAI.length > 0) {
            console.log(`\n╔════════════════════════════════════════════════════════════════════╗`);
            console.log(`║         🤖 Phase 2: AI Processing (${unmappedForAI.length} questions)${' '.repeat(Math.max(0, 26 - unmappedForAI.length.toString().length))}║`);
            console.log(`╚════════════════════════════════════════════════════════════════════╝\n`);

            console.log(`📤 Sending ${unmappedForAI.length} question(s) to AI for processing...\n`);
            console.log(`❓ Questions for AI:`);
            unmappedForAI.forEach((q, idx) => {
                console.log(`   ${idx + 1}. "${q.questionText}"`);
            });
            console.log(``);

            // Notify UI of AI count immediately (before calling AI)
            window.dispatchEvent(new CustomEvent('AI_COUNT_UPDATE', {
                detail: { count: unmappedForAI.length }
            }));

            const aiAnswers = await this.requestAIAnswers(unmappedForAI, profile);

            console.log(`\n📚 Learning from AI responses...`);
            // Learn from each AI response
            for (let i = 0; i < unmappedForAI.length; i++) {
                const question = unmappedForAI[i];
                const answer = aiAnswers[i];

                if (answer) {
                    await this.learnFromAIResponse(question, answer, profile);
                }
            }

            mappedAnswers.push(...aiAnswers);
            console.log(`✅ AI phase complete. Learned ${aiAnswers.length} new patterns.\n`);
        } else {
            console.log(`\n✨ All questions mapped without AI! No AI calls needed.\n`);
        }

        console.log(`\n╔════════════════════════════════════════════════════════════════════╗`);
        console.log(`║           ✅ MAPPING COMPLETE: ${mappedAnswers.length}/${uniqueQuestions.length} Answers Ready${' '.repeat(Math.max(0, 20 - mappedAnswers.length.toString().length - uniqueQuestions.length.toString().length))}║`);
        console.log(`╚════════════════════════════════════════════════════════════════════╝\n`);

        // Summary breakdown
        const canonicalCount = mappedAnswers.filter(a => a.source === 'canonical').length;
        const learnedCount = mappedAnswers.filter(a => a.source === 'learned').length;
        const fuzzyCount = mappedAnswers.filter(a => a.source === 'fuzzy').length;
        const aiCount = mappedAnswers.filter(a => a.source === 'AI').length;

        console.log(`📊 Mapping Source Breakdown:`);
        console.log(`   🎯 Canonical: ${canonicalCount}`);
        console.log(`   🧠 Learned Patterns: ${learnedCount}`);
        console.log(`   🔍 Fuzzy Match: ${fuzzyCount}`);
        console.log(`   🤖 AI Generated: ${aiCount}\n`);

        return mappedAnswers;
    }

    /**
     * Remove duplicate questions based on normalized text
     */
    private removeDuplicates(questions: ScannedQuestion[]): ScannedQuestion[] {
        const seen = new Set<string>();
        const unique: ScannedQuestion[] = [];

        for (const q of questions) {
            const normalized = this.normalizeQuestion(q.questionText);
            if (!seen.has(normalized)) {
                seen.add(normalized);
                unique.push(q);
            } else {
                console.log(`   🔄 Skipping duplicate: "${q.questionText}"`);
            }
        }

        return unique;
    }

    /**
     * Try canonical, learned, and fuzzy matching
     */
    private async tryMapping(question: ScannedQuestion, profile: any): Promise<{ answer: string; source: 'canonical' | 'learned' | 'fuzzy'; confidence: number; fileName?: string } | null> {

        // 0. Check custom answers FIRST (user-edited values take highest priority)
        if (profile.customAnswers && profile.customAnswers[question.questionText]) {
            const customAnswer = profile.customAnswers[question.questionText];
            console.log(`     ⭐ Custom answer found: "${customAnswer}"`);

            // Validate against options if this is a dropdown/radio
            if (question.options && question.options.length > 0) {
                const matched = this.matchInOptions(customAnswer, question.options, 1.0);
                if (matched) {
                    console.log(`     ✓ Custom answer validated against options`);
                    return { ...matched, source: 'canonical' }; // Return as canonical for consistency
                } else {
                    console.log(`     ⚠️ Custom answer not in options - will try canonical matching`);
                }
            } else {
                // Text field, return custom answer directly
                return { answer: customAnswer, source: 'canonical', confidence: 1.0 };
            }
        }

        // 1. Try canonical matching
        console.log(`     🎯 Trying canonical mapping...`);
        const canonicalResult = this.tryCanonical(question, profile);
        if (canonicalResult) {
            console.log(`     ✓ Canonical match found!`);
            return canonicalResult;
        }
        console.log(`     ✗ No canonical match`);

        // 2. Try learned patterns
        console.log(`     🧠 Trying learned patterns...`);
        const learnedResult = await this.tryLearned(question, profile);
        if (learnedResult) {
            console.log(`     ✓ Learned pattern match found!`);
            return learnedResult;
        }
        console.log(`     ✗ No learned pattern match`);

        // 3. Try fuzzy matching with options
        if (question.options && question.options.length > 0) {
            console.log(`     🔍 Trying fuzzy matching with ${question.options.length} options...`);
            const fuzzyResult = this.tryFuzzy(question, profile);
            if (fuzzyResult) {
                console.log(`     ✓ Fuzzy match found!`);
                return fuzzyResult;
            }
            console.log(`     ✗ No fuzzy match`);
        } else {
            console.log(`     ⊗ Fuzzy matching skipped (no options)`);
        }

        return null;
    }

    /**
     * Try learned patterns from storage
     */
    private async tryLearned(question: ScannedQuestion, profile: any): Promise<{ answer: string; source: 'learned'; confidence: number } | null> {
        const pattern = await patternStorage.findPattern(question.questionText);

        if (!pattern) {
            return null;
        }

        // SAFETY CHECK: Ignore learned patterns for generic labels matching "Attach", "Upload", etc.
        // These are context-dependent and a global pattern (e.g. Attach -> Resume) causes issues (e.g. filling Cover Letter)
        const lowerQ = question.questionText.toLowerCase().trim();
        const genericLabels = ['attach', 'upload', 'resume/cv', 'resume', 'cover letter', 'file', 'choose file', 'browse', 'select']; // actually 'resume' is fine, but 'attach' is bad.
        // We only want to block truly context-free generics
        if (['attach', 'upload', 'file', 'choose file', 'browse', 'select file'].includes(lowerQ)) {
            console.log(`[QuestionMapper] ⚠️ Skipping learned pattern for generic question "${question.questionText}"`);
            return null;
        }

        // SAFETY CHECK: If this is a file input, ensure we don't return text answers (e.g. bio/summary)
        // Learned patterns often capture text values for "Attach" if there were text inputs named "Attach" elsewhere
        if (question.fieldType === 'file') {
            // Only proceed if the intent is clearly file-related (RESUME/COVER_LETTER)
            // OR if the answer we would generate is a data URI (unlikely for learned patterns currently)
            const intent = pattern.intent.toLowerCase();
            if (!intent.includes('resume') && !intent.includes('cover') && !intent.includes('cv') && !intent.includes('file')) {
                console.log(`[QuestionMapper] ⚠️ Skipping learned pattern for file input "${question.questionText}": intent "${pattern.intent}" implies text`);
                return null;
            }
        }

        // Get canonical value from profile (optional - may not exist)
        const canonicalValue = this.getValueFromProfile(profile, pattern.intent);

        // INFINITE LEARNING MODE:
        // Try to match stored variants against current options
        // This works even if profile doesn't have this value!
        if (pattern.answerMappings && pattern.answerMappings.length > 0 && question.options) {
            // Try to find variant that matches current options
            for (const mapping of pattern.answerMappings) {
                for (const variant of mapping.variants) {
                    const match = question.options.find(opt =>
                        opt.toLowerCase() === variant.toLowerCase() ||
                        opt.toLowerCase().includes(variant.toLowerCase()) ||
                        variant.toLowerCase().includes(opt.toLowerCase())
                    );

                    if (match) {
                        console.log(`[QuestionMapper] 🎯 Matched stored variant "${variant}" → "${match}"`);
                        return { answer: match, source: 'learned', confidence: pattern.confidence };
                    }
                }
            }
        }

        // Fallback: Use canonical value from profile if available
        if (canonicalValue) {
            // For generic fields with answer mappings, find best variant
            if (pattern.answerMappings && pattern.answerMappings.length > 0) {
                const answer = this.findBestVariant(canonicalValue, pattern.answerMappings, question.options);
                if (answer) {
                    return { answer, source: 'learned', confidence: pattern.confidence };
                }
                // findBestVariant returned null - variant doesn't match options
                // Fall through to let AI handle it
            } else {
                // For personal fields (pattern-only), validate against options if they exist
                if (question.options && question.options.length > 0) {
                    // Check if canonical value matches any option
                    const match = question.options.find(opt =>
                        opt.toLowerCase() === canonicalValue.toLowerCase() ||
                        opt.toLowerCase().includes(canonicalValue.toLowerCase()) ||
                        canonicalValue.toLowerCase().includes(opt.toLowerCase())
                    );
                    if (match) {
                        console.log(`[QuestionMapper] 🔍 Canonical value "${canonicalValue}" matches option "${match}"`);
                        return { answer: match, source: 'learned', confidence: pattern.confidence };
                    }
                    // No match - let AI handle it
                    console.log(`[QuestionMapper] ⚠️ Canonical value "${canonicalValue}" not in options, will use AI`);
                } else {
                    // No options to validate against, return canonical value as-is
                    return { answer: canonicalValue, source: 'learned', confidence: pattern.confidence };
                }
            }
        }

        // NEW: For text fields, try to use the stored answer from pattern
        // even if profile doesn't have this value
        if (!question.options && pattern.answerMappings && pattern.answerMappings.length > 0) {
            const firstMapping = pattern.answerMappings[0];

            // Try variants first
            if (firstMapping.variants && firstMapping.variants.length > 0) {
                const storedAnswer = firstMapping.variants[0];
                console.log(`[QuestionMapper] 📝 Using stored text answer from pattern`);
                return { answer: storedAnswer, source: 'learned', confidence: pattern.confidence };
            }

            // Try canonical value from mapping
            if (firstMapping.canonicalValue) {
                console.log(`[QuestionMapper] 📝 Using stored canonical answer from pattern`);
                return { answer: firstMapping.canonicalValue, source: 'learned', confidence: pattern.confidence };
            }
        }

        // No match found and no profile value - pattern exists but can't use it
        return null;
    }

    /**
     * Get value from profile using intent path
     */
    private getValueFromProfile(profile: any, intent: string): string | null {
        const parts = intent.split('.');
        let value = profile;

        for (const part of parts) {
            value = value?.[part];
            if (value === undefined) return null;
        }

        // Convert booleans to strings
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }

        return value ? String(value) : null;
    }

    /**
     * Find best answer variant for available options
     */
    private findBestVariant(canonicalValue: string, answerMappings: any[], options?: string[]): string | null {
        // Find the mapping for this canonical value
        const mapping = answerMappings.find(m => m.canonicalValue === canonicalValue);
        if (!mapping) return null; // No mapping exists

        if (!options || options.length === 0) {
            // No options available, return first variant
            return mapping.variants[0] || canonicalValue;
        }

        // Find matching variant in options
        for (const variant of mapping.variants) {
            const match = options.find(opt =>
                opt.toLowerCase() === variant.toLowerCase() ||
                opt.toLowerCase().includes(variant.toLowerCase()) ||
                variant.toLowerCase().includes(opt.toLowerCase())
            );
            if (match) {
                console.log(`[QuestionMapper] 🎯 Matched learned variant "${variant}" → "${match}"`);
                return match;
            }
        }

        // No match found - return null so AI can learn correct mapping
        console.log(`[QuestionMapper] ⚠️ No learned variant matches options, will use AI`);
        return null;
    }

    /**
     * Learn from AI response
     */
    private async learnFromAIResponse(question: ScannedQuestion, answer: MappedAnswer, profile: any): Promise<void> {
        // Primary: Use AI-provided intent if available
        let intent: string | null = null;

        if (answer.canonicalKey || (answer as any).intent) {
            // AI provided an intent classification
            intent = answer.canonicalKey || (answer as any).intent;
            console.log(`[QuestionMapper] ✓ Using AI-provided intent: ${intent}`);

            // Handle new intent creation
            if ((answer as any).isNewIntent) {
                console.log(`[QuestionMapper] 🆕 AI suggested new intent: ${intent} ("${(answer as any).suggestedIntentName}")`);
                // Store as a custom intent pattern for future use
                const pattern: any = {
                    questionPattern: this.normalizeQuestion(question.questionText),
                    intent,
                    canonicalKey: intent,
                    fieldType: question.fieldType,
                    confidence: answer.confidence || 0.8,
                    source: 'AI-new',
                    isCustomIntent: true
                };

                if (question.options) {
                    pattern.answerMappings = [{
                        canonicalValue: answer.answer,
                        variants: [answer.answer],
                        contextOptions: question.options
                    }];
                }

                await patternStorage.addPattern(pattern);
                return;
            }
        } else {
            // Fallback: Try to detect intent from question and answer using keywords
            intent = this.detectIntent(question.questionText, answer.answer, profile);
            if (intent) {
                console.log(`[QuestionMapper] ⚠️ Using fallback keyword detection: ${intent}`);
            }
        }

        if (!intent) {
            console.log(`[QuestionMapper] Cannot determine intent for: "${question.questionText}"`);
            return;
        }

        // INFINITE LEARNING MODE:
        // Store the AI's answer as a variant for this intent
        // Build up a knowledge base of answers for each intent over time

        // Try to get canonical value from profile (optional - used as base if available)
        const canonicalValue = this.getValueFromProfile(profile, intent);

        // Use AI's answer as the canonical value if profile doesn't have it
        const valueToStore = canonicalValue || answer.answer;

        console.log(`[QuestionMapper] 📚 Learning variant "${answer.answer}" for intent: ${intent}`);

        // Create pattern with answer variant
        const pattern: any = {
            questionPattern: this.normalizeQuestion(question.questionText),
            intent,
            canonicalKey: intent,
            fieldType: question.fieldType,
            confidence: answer.confidence || 0.8,
            source: 'AI'
        };

        // ALWAYS store answer mappings to build variant knowledge base
        pattern.answerMappings = [{
            canonicalValue: valueToStore,  // The "base" answer (from profile or AI)
            variants: [answer.answer],      // Specific variant used this time
            contextOptions: question.options || []  // Options available when this was used
        }];

        await patternStorage.addPattern(pattern);
        console.log(`[QuestionMapper] ✅ Pattern stored with variant: "${answer.answer}"`);
    }

    /**
     * Detect intent from question and answer
     */
    private detectIntent(questionText: string, answer: string, profile: any): string | null {
        const qLower = questionText.toLowerCase();

        // Check by matching answer to profile values
        if (answer === profile.eeo?.gender) return 'eeo.gender';
        if (answer === profile.eeo?.hispanic) return 'eeo.hispanic';
        if (answer === profile.eeo?.veteran) return 'eeo.veteran';
        if (answer === profile.eeo?.disability) return 'eeo.disability';
        if (answer === profile.eeo?.race) return 'eeo.race';
        if (answer === profile.personal?.firstName) return 'personal.firstName';
        if (answer === profile.personal?.lastName) return 'personal.lastName';
        if (answer === profile.personal?.email) return 'personal.email';
        if (answer === profile.personal?.phone) return 'personal.phone';
        if (answer === profile.personal?.city) return 'personal.city';
        if (answer === profile.personal?.state) return 'personal.state';
        if (answer === profile.personal?.country) return 'personal.country';
        if (answer === profile.social?.linkedin) return 'social.linkedin';
        if (answer === profile.social?.website) return 'social.website';

        // Keyword-based fallback
        if (qLower.includes('gender') || qLower.includes('sex')) return 'eeo.gender';
        if (qLower.includes('hispanic') || qLower.includes('latino')) return 'eeo.hispanic';
        if (qLower.includes('veteran')) return 'eeo.veteran';
        if (qLower.includes('disability')) return 'eeo.disability';
        if (qLower.includes('race') || qLower.includes('ethnicity')) return 'eeo.race';
        if (qLower.includes('sponsor')) return 'workAuth.needsSponsorship';
        if (qLower.includes('authorized') && qLower.includes('work')) return 'workAuth.authorizedUS';
        if (qLower.includes('driver') && qLower.includes('license')) return 'workAuth.driverLicense';
        if (qLower.includes('linkedin')) return 'social.linkedin';
        if (qLower.includes('website') || qLower.includes('portfolio')) return 'social.website';
        if (qLower.includes('first name') || qLower.includes('given name')) return 'personal.firstName';
        if (qLower.includes('last name') || qLower.includes('family name') || qLower.includes('surname')) return 'personal.lastName';
        if (qLower.includes('email')) return 'personal.email';
        if (qLower.includes('phone') || qLower.includes('mobile')) return 'personal.phone';

        return null;
    }

    /**
     * Check if intent is generic (shareable)
     */
    private isGenericIntent(intent: string): boolean {
        const genericIntents = [
            'eeo.gender', 'eeo.hispanic', 'eeo.veteran', 'eeo.disability', 'eeo.race',
            'workAuth.sponsorship', 'workAuth.usAuthorized', 'workAuth.driverLicense',
            'location.country', 'location.state', 'application.hasRelatives'
        ];
        return genericIntents.includes(intent);
    }

    /**
     * Normalize question text for pattern matching
     */
    private normalizeQuestion(questionText: string): string {
        return questionText.toLowerCase()
            .replace(/[*?!]/g, '') // Remove special chars
            .trim();
    }

    /**
     * Canonical matching - exact profile field mapping
     */
    private tryCanonical(question: ScannedQuestion, profile: any): { answer: string; source: 'canonical'; confidence: number; fileName?: string } | null {
        const qLower = question.questionText.toLowerCase();

        /**
         * Helper: Validate canonical answer against dropdown/radio options
         * For dropdown/radio questions, we must ensure the canonical value matches an option
         * Otherwise, return null to let AI handle it
         */
        const validateWithOptions = (canonicalValue: string, fileName?: string): { answer: string; source: 'canonical'; confidence: number; fileName?: string } | null => {
            // If no options, return as-is (text field)
            if (!question.options || question.options.length === 0) {
                return { answer: canonicalValue, source: 'canonical', confidence: 1.0, fileName };
            }

            // For dropdown/radio, validate against options
            const matched = this.matchInOptions(canonicalValue, question.options, 1.0);
            if (matched) {
                console.log(`     ✓ Canonical value "${canonicalValue}" validated against options → "${matched.answer}"`);
                return { ...matched, fileName };
            } else {
                console.log(`     ⚠️ Canonical value "${canonicalValue}" not in options [${question.options.join(', ')}] - skipping`);
                return null; // Let AI handle it
            }
        };

        // ===== PERSONAL INFO =====

        // First name (usually text field, but validate if options exist)
        if ((qLower.includes('first name') || qLower === 'first name') && profile.personal?.firstName) {
            return validateWithOptions(profile.personal.firstName);
        }

        // Last name (usually text field, but validate if options exist)
        if ((qLower.includes('last name') || qLower === 'last name') && profile.personal?.lastName) {
            return validateWithOptions(profile.personal.lastName);
        }

        // Email (usually text field, but validate if options exist)
        if ((qLower.includes('email') || qLower === 'email') && profile.personal?.email) {
            return validateWithOptions(profile.personal.email);
        }

        // Phone (usually text field, but validate if options exist)
        if ((qLower.includes('phone') || qLower === 'phone') && profile.personal?.phone) {
            return validateWithOptions(profile.personal.phone);
        }

        // Country (often dropdown, so validation is critical)
        if (qLower.includes('country') && profile.personal?.country) {
            console.log(`[QuestionMapper] 🌍 Country field detected. Profile value: "${profile.personal.country}"`);
            if (question.options) {
                console.log(`[QuestionMapper] 🌍 Available country options: [${question.options.join(', ')}]`);
            }
            return validateWithOptions(profile.personal.country);
        }

        // City (validate against options - prevents matching "Can you commute to city X?" with city name)
        if (qLower.includes('city') && profile.personal?.city) {
            return validateWithOptions(profile.personal.city);
        }

        // State (validate against options)
        if (qLower.includes('state') && !qLower.includes('united') && profile.personal?.state) {
            return validateWithOptions(profile.personal.state);
        }

        // LinkedIn - comprehensive matching
        if ((qLower.includes('linkedin') ||
            qLower.includes('linked in') ||
            qLower.includes('linkedin profile') ||
            qLower.includes('linkedin url') ||
            qLower.includes('professional profile') ||
            qLower === 'linkedin')) {

            // Debug: Log what we have in profile
            console.log('[QuestionMapper] LinkedIn question detected');
            console.log('[QuestionMapper] profile.social?.linkedin:', profile.social?.linkedin);
            console.log('[QuestionMapper] profile.personal?.linkedin:', profile.personal?.linkedin);

            // Check both locations (social and personal)
            const linkedinUrl = profile.social?.linkedin || profile.personal?.linkedin;
            if (linkedinUrl) {
                console.log('[QuestionMapper] ✅ Using LinkedIn from profile:', linkedinUrl);
                return { answer: linkedinUrl, source: 'canonical', confidence: 1.0 };
            } else {
                console.log('[QuestionMapper] ⚠️ LinkedIn not found in profile!');
            }
        }

        // Website / portfolio - comprehensive matching
        if ((qLower.includes('website') ||
            qLower.includes('portfolio') ||
            qLower.includes('personal website') ||
            qLower.includes('online portfolio') ||
            qLower === 'website') && profile.social?.website) {
            return { answer: profile.social.website, source: 'canonical', confidence: 1.0 };
        }

        // ===== FILE UPLOADS =====

        // Resume/CV
        // CRITICAL: Must explicitly exclude "cover letter" to prevent mis-mapping
        if ((question.fieldType === 'file' && question.selector.includes('resume')) ||
            (qLower.includes('resume') && !qLower.includes('cover')) ||
            qLower.includes('cv') ||
            (question.fieldType === 'file' && qLower === 'attach' && question.selector.includes('resume'))) {

            console.log(`[QuestionMapper] 🔍 Potential Resume match for "${question.questionText}"`);
            console.log(`[QuestionMapper] 🔍 Debug info: Selector="${question.selector}", qLower="${qLower}"`);

            if (profile.documents?.resume?.base64) {
                console.log(`[QuestionMapper] 📎 Resume match CONFIRMED for "${question.questionText}"`);
                // Return base64 data URL format that Selenium expects
                const base64Data = profile.documents.resume.base64;
                // If base64Data already includes the data URL prefix, use as-is
                const dataUrl = base64Data.startsWith('data:') ? base64Data : `data:application/pdf;base64,${base64Data}`;
                const fileName = profile.documents.resume.fileName ||
                    (profile.personal?.firstName && profile.personal?.lastName
                        ? `${profile.personal.firstName}_${profile.personal.lastName}_Resume.pdf`
                        : 'resume.pdf');
                return { answer: dataUrl, source: 'canonical', confidence: 1.0, fileName };
            }
        }


        // ===== WORK AUTHORIZATION =====

        // Driver's License
        if (qLower.includes('driver') && qLower.includes('license')) {
            if (profile.workAuthorization?.driverLicense !== undefined) {
                const answer = this.booleanToYesNo(profile.workAuthorization.driverLicense, question.options || undefined);
                return { answer, source: 'canonical', confidence: 1.0 };
            }
        }

        // Sponsorship
        if (qLower.includes('sponsor') && (qLower.includes('visa') || qLower.includes('work') || qLower.includes('government'))) {
            if (profile.workAuthorization?.needsSponsorship !== undefined) {
                const answer = this.booleanToYesNo(profile.workAuthorization.needsSponsorship, question.options || undefined);
                return { answer, source: 'canonical', confidence: 1.0 };
            }
        }

        // US Authorization - comprehensive matching
        if ((qLower.includes('authorized') || qLower.includes('legally')) &&
            qLower.includes('work') &&
            (qLower.includes('united states') || qLower.includes('u.s.') || qLower.includes('us') || qLower.includes('america'))) {
            if (profile.workAuthorization?.authorizedUS !== undefined) {
                const answer = this.booleanToYesNo(profile.workAuthorization.authorizedUS, question.options || undefined);
                return { answer, source: 'canonical', confidence: 1.0 };
            }
        }

        // ===== APPLICATION QUESTIONS =====

        // Related to Employee
        if ((qLower.includes('relat') && qLower.includes('employee')) || (qLower.includes('friend') && qLower.includes('work'))) {
            if (profile.application?.hasRelatives !== undefined) {
                const answer = this.booleanToYesNo(profile.application.hasRelatives, question.options || undefined);
                return { answer, source: 'canonical', confidence: 1.0 };
            }
        }

        // Previously Applied
        if (qLower.includes('previously') && qLower.includes('appl')) {
            if (profile.application?.previouslyApplied !== undefined) {
                const answer = this.booleanToYesNo(profile.application.previouslyApplied, question.options || undefined);
                return { answer, source: 'canonical', confidence: 1.0 };
            }
        }

        // ===== EEO QUESTIONS =====

        // Gender
        if (qLower.includes('gender') && profile.eeo?.gender) {
            return this.matchInOptions(profile.eeo.gender, question.options || undefined, 1.0);
        }

        // Hispanic/Latino
        if ((qLower.includes('hispanic') || qLower.includes('latino')) && profile.eeo?.hispanic) {
            return this.matchInOptions(profile.eeo.hispanic, question.options || undefined, 1.0);
        }

        // Veteran Status
        if (qLower.includes('veteran') && profile.eeo?.veteran) {
            return this.matchInOptions(profile.eeo.veteran, question.options || undefined, 1.0);
        }

        // Disability
        if (qLower.includes('disability') && profile.eeo?.disability) {
            return this.matchInOptions(profile.eeo.disability, question.options || undefined, 1.0);
        }

        // Race
        if (qLower.includes('race') && profile.eeo?.race) {
            return this.matchInOptions(profile.eeo.race, question.options || undefined, 1.0);
        }

        // Sexual Orientation (NEW - prevent AI calls)
        if ((qLower.includes('sexual orientation') || qLower.includes('sexual identity')) && profile.eeo?.sexualOrientation) {
            return this.matchInOptions(profile.eeo.sexualOrientation, question.options || undefined, 1.0);
        }

        return null;
    }

    /**
     * Fuzzy matching - match profile values to available options
     */
    private tryFuzzy(question: ScannedQuestion, profile: any): { answer: string; source: 'canonical' | 'fuzzy'; confidence: number } | null {
        if (!question.options) return null;

        const qLower = question.questionText.toLowerCase();

        // Gender matching (fallback if not in eeo)
        if (qLower.includes('gender') && profile.personal?.gender) {
            return this.matchInOptions(profile.personal.gender, question.options || undefined, 0.9);
        }

        return null;
    }

    /**
     * Fuzzy match a value to the closest option in the list
     * Used to validate AI responses against available options
     */
    private fuzzyMatchOption(value: string, options: string[]): string | null {
        const result = this.matchInOptions(value, options, 0.9);
        return result ? result.answer : null;
    }

    /**
     * Convert boolean to Yes/No based on available options
     */
    private booleanToYesNo(value: boolean, options?: string[]): string {
        if (!options || options.length === 0) {
            return value ? 'Yes' : 'No';
        }

        // Find Yes option
        if (value) {
            const yesOption = options.find(opt =>
                opt.toLowerCase().includes('yes') ||
                opt.toLowerCase() === 'y' ||
                opt.toLowerCase().includes('true') ||
                opt.toLowerCase() === 'i do'
            );
            return yesOption || 'Yes';
        }

        // Find No option
        const noOption = options.find(opt =>
            opt.toLowerCase().includes('no') ||
            opt.toLowerCase() === 'n' ||
            opt.toLowerCase().includes('false') ||
            opt.toLowerCase() === 'i do not' ||
            opt.toLowerCase() === `i don't` ||
            opt.toLowerCase().includes('prefer not')
        );
        return noOption || 'No';
    }

    /**
     * Match stored value to best option
     */
    private matchInOptions(value: string, options?: string[], confidence: number = 1.0): { answer: string; source: 'canonical'; confidence: number } | null {
        if (!options || options.length === 0) {
            return { answer: value, source: 'canonical', confidence };
        }

        const valueLower = value.toLowerCase().trim();

        // 1. Exact match
        const exactMatch = options.find(opt => opt.toLowerCase().trim() === valueLower);
        if (exactMatch) {
            return { answer: exactMatch, source: 'canonical', confidence };
        }

        // 1.5 Synonym match (Male matched to Man, etc.)
        const synonyms: Record<string, string[]> = {
            'male': ['man', 'cisgender male', 'cis male'],
            'female': ['woman', 'cisgender female', 'cis female'],
            'man': ['male', 'cisgender male', 'cis male'],
            'woman': ['female', 'cisgender female', 'cis female'],
            'non-binary': ['nonbinary', 'genderqueer', 'gender non-conforming', 'gender non-binary', 'non-binary/non-conforming'],
            'prefer not to say': ['decline to self-identify', 'decline to state', 'i prefer not to answer', 'prefer not to disclose'],
            'yes': ['y', 'true', 'i do', 'authorized'],
            'no': ['n', 'false', 'i do not', 'not authorized']
        };

        if (synonyms[valueLower]) {
            for (const synonym of synonyms[valueLower]) {
                const synonymMatch = options.find(opt => opt.toLowerCase().trim() === synonym);
                if (synonymMatch) {
                    console.log(`[QuestionMapper] 🔄 Synonym matched "${value}" → "${synonymMatch}"`);
                    return { answer: synonymMatch, source: 'canonical', confidence };
                }
            }
        }

        // 2. Partial match (contains)
        const partialMatch = options.find(opt =>
            opt.toLowerCase().includes(valueLower) ||
            valueLower.includes(opt.toLowerCase())
        );
        if (partialMatch) {
            console.log(`[QuestionMapper] 🔍 Fuzzy matched "${value}" → "${partialMatch}"`);
            return { answer: partialMatch, source: 'canonical', confidence };
        }

        // 3. Word-level matching (for country names, etc.)
        // "USA" should match "United States +1"
        // "India" should match "India +91"
        const valueWords = valueLower.split(/\s+/);
        const wordMatch = options.find(opt => {
            const optLower = opt.toLowerCase();
            // Check if option starts with the value
            if (optLower.startsWith(valueLower)) return true;

            // Check if any word in value matches the start of option
            for (const word of valueWords) {
                if (optLower.startsWith(word) && word.length >= 3) return true;
            }
            return false;
        });
        if (wordMatch) {
            console.log(`[QuestionMapper] 🔍 Word matched "${value}" → "${wordMatch}"`);
            return { answer: wordMatch, source: 'canonical', confidence };
        }

        // 4. Country abbreviation mapping (common cases)
        const countryMap: Record<string, string> = {
            'usa': 'united states',
            'us': 'united states',
            'uk': 'united kingdom',
            'uae': 'united arab emirates'
        };

        if (countryMap[valueLower]) {
            const mappedName = countryMap[valueLower];
            const countryMatch = options.find(opt =>
                opt.toLowerCase().includes(mappedName)
            );
            if (countryMatch) {
                console.log(`[QuestionMapper] 🌍 Country abbreviation "${value}" → "${countryMatch}"`);
                return { answer: countryMatch, source: 'canonical', confidence };
            }
        }

        // No match found - return null so we can try AI with context
        console.log(`[QuestionMapper] ⚠️ Canonical value "${value}" not in options, will use AI`);
        return null;
    }

    /**
     * Request AI answers for unmapped questions
     * ⚡ PARALLEL PROCESSING - all AI calls happen simultaneously
     */
    private async requestAIAnswers(questions: ScannedQuestion[], profile: any): Promise<MappedAnswer[]> {
        console.log(`⚡ Processing ${questions.length} AI question(s) in PARALLEL...`);
        const startTime = Date.now();
        console.log(`⏱️  AI request started at ${new Date().toLocaleTimeString()}\n`);

        // Create all AI request promises at once (parallel execution)
        const aiPromises = questions.map(async (q, index) => {
            try {
                // Dispatch START event for UI
                window.dispatchEvent(new CustomEvent('AI_PROGRESS', {
                    detail: {
                        current: index + 1,
                        total: questions.length,
                        question: q.questionText,
                        status: 'processing'
                    }
                }));

                console.log(`   📤 [${index + 1}/${questions.length}] Asking AI: "${q.questionText}"`);
                if (q.options && q.options.length > 0 && q.options.length <= 20) {
                    console.log(`      Options provided: [${q.options.slice(0, 3).join(', ')}${q.options.length > 3 ? '...' : ''}]`);
                }

                const aiResponse = await askAI({
                    question: q.questionText,
                    fieldType: q.fieldType,
                    // Limit options sent to AI - only send if <= 20 options
                    // This prevents overwhelming the prompt with long lists (like Country)
                    // but ensures we send options for small sets (Gender, Race, etc.)
                    options: (q.options && q.options.length <= 20) ? q.options : [],
                    userProfile: profile
                });

                if (aiResponse.answer) {
                    const intentInfo = aiResponse.intent
                        ? `, intent: ${aiResponse.intent}${aiResponse.isNewIntent ? ' (NEW)' : ''}`
                        : '';
                    console.log(`   📥 [${index + 1}/${questions.length}] AI Response: "${aiResponse.answer}" (${(aiResponse.confidence * 100).toFixed(0)}% confidence${intentInfo})`);

                    // CRITICAL: Validate AI answer against available options
                    let finalAnswer = aiResponse.answer;
                    if (q.options && q.options.length > 0) {
                        // Check if AI answer exists in options (exact match)
                        const exactMatch = q.options.find(opt =>
                            opt.toLowerCase().trim() === aiResponse.answer.toLowerCase().trim()
                        );

                        if (!exactMatch) {
                            console.warn(`      ⚠️ AI answer "${aiResponse.answer}" not in options, trying fuzzy match...`);

                            // Try fuzzy matching to find closest option
                            const fuzzyMatch = this.fuzzyMatchOption(aiResponse.answer, q.options);
                            if (fuzzyMatch) {
                                console.log(`      ✅ Fuzzy matched "${aiResponse.answer}" → "${fuzzyMatch}"`);
                                finalAnswer = fuzzyMatch;
                            } else {
                                console.error(`      ❌ AI answer "${aiResponse.answer}" not found in options for "${q.questionText}"`);
                                return null; // Skip this question if we can't match
                            }
                        } else {
                            finalAnswer = exactMatch; // Use the exact match from options
                            console.log(`      ✓ Exact match found in options`);
                        }
                    }

                    // Dispatch COMPLETE event for UI
                    window.dispatchEvent(new CustomEvent('AI_PROGRESS', {
                        detail: {
                            current: index + 1,
                            total: questions.length,
                            question: q.questionText,
                            status: 'complete',
                            answer: finalAnswer
                        }
                    }));

                    return {
                        selector: q.selector,
                        questionText: q.questionText,
                        answer: finalAnswer,  // Use validated answer
                        source: 'AI' as const,
                        confidence: aiResponse.confidence || 0.8,
                        required: q.required,
                        fieldType: q.fieldType,
                        options: q.options || undefined,
                        canonicalKey: aiResponse.intent,  // Pass intent to learning method
                        ...(aiResponse.isNewIntent && { isNewIntent: aiResponse.isNewIntent, suggestedIntentName: aiResponse.suggestedIntentName })
                    } as MappedAnswer;
                } else {
                    console.warn(`   ⚠️ [${index + 1}/${questions.length}] AI returned no answer for: \"${q.questionText}\"`);
                    return null;
                }
            } catch (error) {
                console.error(`   ❌ [${index + 1}/${questions.length}] AI error for \"${q.questionText}\":`, error);
                return null;
            }
        });

        // Wait for ALL AI requests to complete simultaneously
        const results = await Promise.all(aiPromises);

        // Filter out null results
        const aiAnswers: MappedAnswer[] = results.filter((answer) => answer !== null) as MappedAnswer[];

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);
        console.log(`\n⚡ Parallel AI processing complete in ${duration}s`);
        console.log(`✅ Successfully answered: ${aiAnswers.length}/${questions.length} questions`);
        if (aiAnswers.length < questions.length) {
            console.log(`⚠️  Failed to answer: ${questions.length - aiAnswers.length} question(s)`);
        }

        return aiAnswers;
    }

    /**
     * Convert mapped answers to Selenium fill plan format
     */
    async convertToFillPlan(answers: MappedAnswer[], jobUrl: string): Promise<any> {
        // Load profile to get file names
        const profile = await loadProfile();

        console.log(`\n[QuestionMapper] Converting ${answers.length} answers to fill plan...`);

        return {
            jobUrl,
            actions: answers.map(a => {
                const actionType = this.mapFieldTypeToAction(a.fieldType);
                const action: any = {
                    id: a.selector,
                    type: actionType,
                    selector: a.selector,
                    value: a.answer,
                    required: a.required
                };

                console.log(`[QuestionMapper] 📋 "${a.questionText}" → ${actionType} = "${a.answer}"`);

                // Add fileName for file uploads
                if (a.fieldType === 'file' && profile) {
                    if (a.selector.includes('resume') && profile.documents?.resume?.fileName) {
                        action.fileName = profile.documents.resume.fileName;
                    } else if (a.selector.includes('cover') && profile.documents?.coverLetter?.fileName) {
                        action.fileName = profile.documents.coverLetter.fileName;
                    }
                }

                return action;
            })
        };
    }

    private mapFieldTypeToAction(fieldType: string): string {
        const typeMap: Record<string, string> = {
            'text': 'input_text',
            'email': 'input_text',
            'tel': 'input_text',
            'number': 'input_text',
            'textarea': 'input_text',
            'select': 'dropdown_native',          // Native HTML <select> elements
            'dropdown_custom': 'dropdown_custom',  // React-Select / Greenhouse dropdowns
            'radio': 'radio',
            'checkbox': 'checkbox',
            'date': 'input_text',
            'file': 'input_file'
        };

        return typeMap[fieldType] || 'input_text';
    }
}
