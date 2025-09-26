const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Load environment variables for local development
require('dotenv').config();

// --- Configuration ---
const OUTPUT_DIR = 'dist';
const TOPICS_SUBDIR = 'topics';

// --- Firebase Initialization ---
try {
    // In a Netlify build environment, these will be set as environment variables.
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error('Firebase credentials are not fully set in the environment.');
    }

    const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };

    initializeApp({
        credential: cert(serviceAccount)
    });
} catch (error) {
    console.error('Build failed: Could not initialize Firebase.', error.message);
    process.exit(1); // Exit if Firebase can't be initialized
}

const db = getFirestore();

// --- Helper Functions ---
function slugify(text) {
    if (typeof text !== 'string') return 'untitled-topic';

    const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
    const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
    const p = new RegExp(a.split('').join('|'), 'g')

    return text.toString().toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with -
        .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
        .replace(/&/g, '-and-') // Replace & with 'and'
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars except hyphen
        .replace(/\-\-+/g, '-') // Replace multiple - with single -
        .replace(/^-+/, '') // Trim - from start of text
        .replace(/-+$/, '') // Trim - from end of text
}

async function fetchAllTopics() {
    const allTopics = [];
    const categoriesSnapshot = await db.collection('categories').get();

    for (const categoryDoc of categoriesSnapshot.docs) {
        const subcategoriesSnapshot = await db.collection('categories').doc(categoryDoc.id).collection('subcategories').get();
        for (const subcategoryDoc of subcategoriesSnapshot.docs) {
            const topicsSnapshot = await db.collection('categories').doc(categoryDoc.id).collection('subcategories').doc(subcategoryDoc.id).collection('topics').get();
            topicsSnapshot.forEach(topicDoc => {
                allTopics.push({
                    id: topicDoc.id,
                    ...topicDoc.data(),
                    category: categoryDoc.id,
                    subcategory: subcategoryDoc.id,
                });
            });
        }
    }
    return allTopics;
}

function generateTopicCardHTML(topic) {
    const slug = slugify(topic.title);
    // The link now just goes to the static page. The client-side JS will get info from the URL or embedded JSON.
    const link = `/topics/${slug}.html?id=${topic.id}&category=${encodeURIComponent(topic.category)}&subcategory=${encodeURIComponent(topic.subcategory)}`;
    
    const totalVotes = topic.perspectives ? Object.values(topic.perspectives).reduce((sum, p) => sum + p.votes, 0) : 0;
    const firstImage = topic.media && topic.media.find(item => item.type === 'image');
    const imageUrl = firstImage ? firstImage.url : `https://placehold.co/600x400/e2e8f0/64748b?text=${encodeURIComponent(topic.title)}`;

    return `
    <a href="${link}" class="topic-card rounded-2xl shadow-lg flex flex-col" data-topic-id="${topic.id}">
        <div class="relative pt-[56.25%] rounded-t-2xl overflow-hidden">
             <img src="${imageUrl}" alt="${topic.title || 'Topic'}" class="absolute top-0 left-0 w-full h-full object-cover" loading="lazy">
        </div>
        <div class="p-4 flex-grow flex flex-col">
            <div><span class="subcategory-tag">${topic.subcategory}</span></div>
            <h3 class="font-bold text-lg mt-2">${topic.title || 'Untitled Topic'}</h3>
            <p class="topic-card-description text-sm text-[var(--color-text-secondary)] mt-2">${topic.description || ''}</p>
        </div>
        <div class="px-4 pb-4 border-t border-[var(--color-border)]/50 flex justify-between items-center mt-auto pt-3">
            <div class="flex items-center gap-4 text-sm text-[var(--color-text-secondary)]">
                <button class="like-button flex items-center gap-1.5 hover:text-red-500">
                    <svg class="heart-outline w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
                    <svg class="heart-filled w-5 h-5 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9-22.247 22.247 0 01-2.644-2.437 24.362 24.362 0 01-1.644-2.296C1.025 6.42 2.342 4.148 4.793 4.148c1.393 0 2.68.723 3.432 1.855c.753-1.132 2.04-1.855 3.433-1.855c2.45 0 3.768 2.272 3.22 5.263c-.538 2.957-2.956 5.395-5.948 7.532a24.394 24.394 0 01-1.644 1.037z" /></svg>
                    <span class="like-count font-medium">${topic.likes || 0}</span>
                </button>
                <span class="flex items-center gap-1.5">
                     <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span>${totalVotes}</span>
                </span>
            </div>
            <div class="text-sm font-bold text-[var(--color-primary-accent-text)] group">
                Explore Now <span class="inline-block transition-transform group-hover:translate-x-1">&rarr;</span>
            </div>
        </div>
    </a>`;
}

// --- Main Build Logic ---
async function build() {
    try {
        console.log('Starting site build...');

        const topicsDir = path.join(OUTPUT_DIR, TOPICS_SUBDIR);
        if (fs.existsSync(OUTPUT_DIR)) fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
        fs.mkdirSync(topicsDir, { recursive: true });

        // Copy static assets like admin page
        fs.copyFileSync('admin.html', path.join(OUTPUT_DIR, 'admin.html'));
        console.log('Copied static file (admin.html).');
        
        const topicTemplate = fs.readFileSync('topic-template.html', 'utf-8');
        const indexTemplate = fs.readFileSync('index-template.html', 'utf-8');

        const topics = await fetchAllTopics();
        console.log(`Fetched ${topics.length} total topics from Firestore.`);

        // --- Generate index.html with pre-rendered recent topics ---
        let recentTopicListHtml = '';
        const sortedTopics = topics.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        // We pre-render the first few topics for fast initial load. The rest are handled by JS.
        sortedTopics.slice(0, 12).forEach(topic => {
            recentTopicListHtml += generateTopicCardHTML(topic);
        });

        const finalIndexHtml = indexTemplate.replace('<!--TOPIC_LIST_PLACEHOLDER-->', recentTopicListHtml);
        fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), finalIndexHtml);
        console.log('Generated index.html with statically rendered recent topics.');

        // --- Generate individual topic pages ---
        let generatedCount = 0;
        for (const topic of topics) {
             try {
                const slug = slugify(topic.title);
                if (!slug || slug === 'untitled-topic') {
                    console.warn(`Skipping topic with ID ${topic.id} due to invalid title.`);
                    continue;
                }
                
                const topicPath = path.join(topicsDir, `${slug}.html`);
                const topicUrl = `https://perspp.netlify.app/topics/${slug}.html`; // Replace with your actual domain

                // Make Firestore Timestamps JSON serializable
                const serializableTopic = { ...topic };
                if (serializableTopic.timestamp && serializableTopic.timestamp.toDate) {
                    serializableTopic.timestamp = serializableTopic.timestamp.toDate().toISOString();
                }
                 if (serializableTopic.pollClosesAt && serializableTopic.pollClosesAt.toDate) {
                    serializableTopic.pollClosesAt = serializableTopic.pollClosesAt.toDate().toISOString();
                }

                // Replace placeholders in the template
                const finalHtml = topicTemplate
                    .replace(/__OG_TITLE__/g, topic.title || 'Perspective Poll Topic')
                    .replace(/__OG_DESCRIPTION__/g, topic.description || 'Join the discussion on Perspective Poll.')
                    .replace(/__OG_IMAGE__/g, (topic.media && topic.media[0] && topic.media[0].type === 'image' && topic.media[0].url) || 'https://placehold.co/1200x630/3b82f6/ffffff?text=Perspective%0APoll')
                    .replace(/__OG_URL__/g, topicUrl)
                    // **IMPROVEMENT**: Embed the topic data directly into the HTML page
                    .replace('__TOPIC_DATA_JSON__', JSON.stringify(serializableTopic));

                fs.writeFileSync(topicPath, finalHtml);
                generatedCount++;

            } catch(topicError) {
                console.error(`\n--- FAILED to generate page for topic: "${topic.title || 'NO TITLE'}" (ID: ${topic.id}) ---`);
                console.error('--- REASON:', topicError.message);
            }
        }
        
        console.log(`\nGenerated ${generatedCount} topic pages.`);
        console.log('Build finished successfully!');

    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1); // Exit with an error code
    }
}

build();
