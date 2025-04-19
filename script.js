const fileInput = document.getElementById('jsonFile');
const chatContainer = document.getElementById('chat-container');

fileInput.addEventListener('change', handleFileSelect);

/**
 * Handles the file selection event, reads the file, and initiates processing.
 * @param {Event} event - The file input change event.
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        chatContainer.innerHTML = '<p class="error">No file selected.</p>';
        return;
    }

    // Basic check, processing will handle actual content format
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        console.warn(`File type is not application/json (Type: ${file.type}), proceeding because of .json extension.`);
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        const rawText = e.target.result;
        let processedText = ''; // Define outside try for error reporting

        try {
            processedText = rawText.trim();

            if (!processedText) {
                chatContainer.innerHTML = '<p class="error">File is empty.</p>';
                return;
            }

            // --- Preprocessing for Concatenated or Single JSON Objects ---
            // Check if the text is already a valid JSON array
            const isLikelyValidArray = processedText.startsWith('[') && processedText.endsWith(']');

            if (!isLikelyValidArray) {
                // Assume it's NOT a valid array (could be single object or concatenated)
                // Apply the fix: replace separators and wrap in brackets.
                console.log("Applying preprocessing for concatenated/single JSON object format.");
                processedText = processedText.replace(/}\s*{/g, '},{'); // Replace separators
                processedText = '[' + processedText + ']';            // Wrap in array brackets
            }
            // --- End Preprocessing ---

            // Now parse the potentially modified string
            const chatDataArray = JSON.parse(processedText);
            console.log("JSON parsing successful. Parsed items:", chatDataArray.length);

            // --- Data Extraction ---
            // Flatten the array of actions from all top-level items
            let chatActions = [];
            if (Array.isArray(chatDataArray)) {
                chatActions = chatDataArray.flatMap(item => item?.replayChatItemAction?.actions || item?.continuationContents?.liveChatContinuation?.actions || []);
                 console.log(`Extracted ${chatActions.length} actions total.`);
            } else {
                 // Should not happen with preprocessing, but acts as a safeguard
                 throw new Error("Internal error: Processed data is not an array.");
            }

            if (!Array.isArray(chatActions)) {
                 // Should not happen with flatMap, but acts as a safeguard
                 throw new Error("Internal error: chatActions is not an array.");
            }

            // Filter and process the actions
            displayChatMessages(chatActions);

        } catch (error) {
             console.error("Error during file processing:", error);
             // Log relevant info for debugging, if needed
             // console.error("Raw text snippet (first 500 chars):", rawText.substring(0, 500));
             // console.error("Processed text snippet (first 100 chars):", processedText.substring(0, 100));

             let userMessage = `Error processing file: ${error.message}.`;
             if (error instanceof SyntaxError) {
                  userMessage = `Error parsing JSON: ${error.message}. The file might be corrupted or have an unexpected format.`;
             }
             chatContainer.innerHTML = `<p class="error">${userMessage} Check console for more details.</p>`;
        }
    };

    reader.onerror = function(e) {
        console.error("Error reading file:", e);
        chatContainer.innerHTML = '<p class="error">Error reading file.</p>';
    };

    reader.readAsText(file);
}

/**
 * Processes message runs (text and emojis) and appends them to a target HTML element.
 * @param {Array|undefined} runs - The array of run objects from the message data.
 * @param {HTMLElement} targetElement - The HTML element to append content to.
 */
function processMessageRuns(runs, targetElement) {
    if (!runs || !Array.isArray(runs)) {
        targetElement.textContent = ''; // Clear if no runs
        return;
    }
    runs.forEach(run => {
        if (run.text) {
            targetElement.appendChild(document.createTextNode(run.text));
        } else if (run.emoji) {
            const emoji = run.emoji;
            const img = document.createElement('img');
            img.classList.add('chat-emoji');
            img.src = emoji.image?.thumbnails?.[0]?.url || ''; // Use smallest thumbnail
            const altText = emoji.accessibility?.accessibilityData?.label || emoji.shortcuts?.[0] || 'emoji';
            img.alt = altText;
            img.title = altText; // Tooltip on hover

            img.onerror = () => {
                // Fallback if image fails to load: display alt text
                const fallbackText = document.createTextNode(`[${altText}]`);
                img.replaceWith(fallbackText);
            };

             // Only append if src is valid; otherwise, use fallback directly
             if (img.src) {
                 targetElement.appendChild(img);
             } else {
                 targetElement.appendChild(document.createTextNode(`[${altText}]`));
             }
        }
        // TODO: Potentially handle other run types like links if needed
    });
}

/**
 * Displays the processed chat messages in the chat container.
 * @param {Array} actions - The array of chat actions to display.
 */
function displayChatMessages(actions) {
    chatContainer.innerHTML = ''; // Clear previous content
    let messageCount = 0;
    let skippedTickerCount = 0;
    let skippedOtherActionCount = 0;
    let skippedOtherItemCount = 0;

    if (!actions || actions.length === 0) {
        // Handle case where parsing was successful but no actions were found/extracted
        chatContainer.innerHTML = '<p>No chat actions found in the file data.</p>';
        return;
    }

    actions.forEach((action) => {
        // Determine the type of action
        const addChatItemAction = action?.addChatItemAction;
        const addTickerItemAction = action?.addLiveChatTickerItemAction;

        if (addChatItemAction) {
            const item = addChatItemAction.item;
            if (!item) {
                 // This indicates a data structure issue
                 console.warn("Found addChatItemAction without an item.", addChatItemAction);
                 skippedOtherActionCount++; // Count as a skipped action/item problem
                 return;
            }

            // Determine the type of chat item renderer
            const textRenderer = item.liveChatTextMessageRenderer;
            const memberRenderer = item.liveChatMembershipItemRenderer;
            // const paidRenderer = item.liveChatPaidMessageRenderer; // Example for Super Chat
            // Add other renderers here as needed

            let rendererData = null;
            let messageTypeClass = ''; // Optional CSS class for styling specific types

            // Assign the correct renderer data and class
            if (textRenderer) {
                rendererData = textRenderer;
                // messageTypeClass = 'chat-text-message'; // Uncomment if specific styling is needed
            } else if (memberRenderer) {
                rendererData = memberRenderer;
                messageTypeClass = 'chat-membership-message';
            }
            // else if (paidRenderer) { rendererData = paidRenderer; messageTypeClass = 'chat-paid-message'; }
            else {
                // Skip item types we don't explicitly handle
                skippedOtherItemCount++;
                // console.log("Skipping unhandled item type:", Object.keys(item)[0]); // Uncomment for debugging
                return;
            }

            messageCount++;

            // --- Common Data Extraction ---
            const authorPhotoUrl = rendererData.authorPhoto?.thumbnails?.[0]?.url || 'placeholder.png';
            const timestampText = rendererData.timestampText?.simpleText || '[no time]';
            const authorNameText = rendererData.authorName?.simpleText || '[unknown author]';
            const authorBadges = rendererData.authorBadges || [];

            // --- Element Creation ---
            const messageElement = document.createElement('div');
            messageElement.classList.add('chat-message');
            if (messageTypeClass) {
                messageElement.classList.add(messageTypeClass);
            }

            // 1. Author Photo
            const authorImg = document.createElement('img');
            authorImg.src = authorPhotoUrl;
            authorImg.alt = "Author";
            authorImg.classList.add('author-photo');
            authorImg.onerror = () => { authorImg.src = 'placeholder.png'; authorImg.alt = 'Default Avatar'; };
            messageElement.appendChild(authorImg);

            // 2. Message Content container
            const contentDiv = document.createElement('div');
            contentDiv.classList.add('message-content');

            // 2a. Message Header (Timestamp, Author, Badges)
            const headerDiv = document.createElement('div');
            headerDiv.classList.add('message-header');

            const timeSpan = document.createElement('span');
            timeSpan.classList.add('timestamp');
            timeSpan.textContent = timestampText;
            headerDiv.appendChild(timeSpan);

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('author-name');
            nameSpan.textContent = authorNameText;
            headerDiv.appendChild(nameSpan);

            authorBadges.forEach(badgeItem => {
                const badgeRenderer = badgeItem?.liveChatAuthorBadgeRenderer;
                if (badgeRenderer?.customThumbnail?.thumbnails?.[0]?.url) {
                    const badgeImg = document.createElement('img');
                    badgeImg.src = badgeRenderer.customThumbnail.thumbnails[0].url;
                    badgeImg.alt = badgeRenderer.tooltip || 'Badge';
                    badgeImg.title = badgeRenderer.tooltip || 'Badge';
                    badgeImg.classList.add('author-badge');
                    badgeImg.onerror = () => { badgeImg.style.display = 'none'; }; // Hide if badge image fails
                    headerDiv.appendChild(badgeImg);
                }
            });
            contentDiv.appendChild(headerDiv);

            // 2b. Message Body (Processed based on renderer type)
            const bodyDiv = document.createElement('div');
            bodyDiv.classList.add('message-body');

            if (textRenderer) {
                processMessageRuns(textRenderer.message?.runs, bodyDiv);
            } else if (memberRenderer) {
                // Handle specific structure of membership messages
                 if (memberRenderer.headerPrimaryText?.runs) {
                     const primaryHeader = document.createElement('span');
                     primaryHeader.classList.add('membership-header-primary');
                     processMessageRuns(memberRenderer.headerPrimaryText.runs, primaryHeader);
                     bodyDiv.appendChild(primaryHeader);
                 }
                 if (memberRenderer.headerSubtext?.simpleText) {
                     const subHeader = document.createElement('span');
                     subHeader.classList.add('membership-header-subtext');
                     subHeader.textContent = memberRenderer.headerSubtext.simpleText;
                     bodyDiv.appendChild(subHeader);
                 }
                 // Membership items can also have a 'message' part (e.g., welcome emojis)
                 if (memberRenderer.message?.runs) {
                    processMessageRuns(memberRenderer.message.runs, bodyDiv);
                 }
            }
            // else if (paidRenderer) { /* Process super chat body */ }

            contentDiv.appendChild(bodyDiv);
            messageElement.appendChild(contentDiv);
            chatContainer.appendChild(messageElement); // Add the complete message element

        } else if (addTickerItemAction) {
            // Silently skip ticker items, just count them
            skippedTickerCount++;
        } else {
            // Skip other action types we don't handle
            skippedOtherActionCount++;
            // console.log("Skipping unhandled action type:", Object.keys(action)[0]); // Uncomment for debugging
        }
    });

    // --- Summary Message ---
    const summary = document.createElement('p');
    let summaryText;

    if (messageCount === 0 && actions.length > 0) {
         summaryText = `Processed ${actions.length} actions, but found no displayable messages.`;
    } else if (actions.length === 0) {
         // This case is handled earlier, but included for completeness
         summaryText = `No chat actions found in the file data.`;
    } else {
        summaryText = `Displayed ${messageCount} messages.`;
    }

    // Add counts of skipped items if any were skipped
    const skippedMessages = [];
    if (skippedTickerCount > 0) skippedMessages.push(`${skippedTickerCount} ticker`);
    if (skippedOtherItemCount > 0) skippedMessages.push(`${skippedOtherItemCount} unhandled item types`);
    if (skippedOtherActionCount > 0) skippedMessages.push(`${skippedOtherActionCount} unhandled action types`);

    if (skippedMessages.length > 0) {
        summaryText += ` (Skipped: ${skippedMessages.join(', ')})`;
    }

    summary.textContent = summaryText;
    chatContainer.prepend(summary); // Add summary to the top

    // Scroll to top after loading
    chatContainer.scrollTop = 0;
}
