const fs = require('fs');
const path = require('path');
const { shardedDataService } = require('../lib/shardedFlatFileDB');

console.log('=== Migrating Legacy Data to Sharded System ===\n');

// Migrate Logs
const logsPath = path.join(__dirname, '../secure_data/logs.json');
if (fs.existsSync(logsPath)) {
    const oldLogs = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
    console.log(`Found ${oldLogs.length} legacy logs`);

    const logsManager = shardedDataService.getManager('logs');
    let migratedLogs = 0;

    for (const log of oldLogs) {
        try {
            const existing = logsManager.read(log.id);
            if (!existing) {
                const newLog = {
                    ...log,
                    date: log.timestamp ? log.timestamp.split('T')[0] : new Date().toISOString().split('T')[0]
                };
                logsManager.create(newLog);
                migratedLogs++;
            }
        } catch (e) {
            // Skip errors silently for logs
        }
    }
    console.log(`Migrated ${migratedLogs} logs\n`);
} else {
    console.log('No legacy logs file found\n');
}

// Migrate Comments
const commentsPath = path.join(__dirname, '../secure_data/comments.json');
if (fs.existsSync(commentsPath)) {
    const oldComments = JSON.parse(fs.readFileSync(commentsPath, 'utf8'));
    console.log(`Found ${oldComments.length} legacy comments`);

    const commentsManager = shardedDataService.getManager('comments');
    let migratedComments = 0;

    for (const comment of oldComments) {
        try {
            const existing = commentsManager.read(comment.id);
            if (!existing) {
                // Convert 'approved' to 'status' for consistency
                const newComment = {
                    ...comment,
                    status: comment.approved ? 'approved' : (comment.status || 'pending')
                };
                commentsManager.create(newComment);
                migratedComments++;
            }
        } catch (e) {
            console.error('Error migrating comment:', comment.id, e.message);
        }
    }
    console.log(`Migrated ${migratedComments} comments\n`);
} else {
    console.log('No legacy comments file found\n');
}

// Migrate Messages
const messagesPath = path.join(__dirname, '../secure_data/messages.json');
if (fs.existsSync(messagesPath)) {
    const oldMessages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
    console.log(`Found ${oldMessages.length} legacy messages`);

    const messagesManager = shardedDataService.getManager('messages');
    let migratedMessages = 0;

    for (const message of oldMessages) {
        try {
            const existing = messagesManager.read(message.id);
            if (!existing) {
                // Convert 'read' to 'isRead' for consistency
                const newMessage = {
                    ...message,
                    isRead: message.read || message.isRead || false,
                    status: message.status || 'new'
                };
                messagesManager.create(newMessage);
                migratedMessages++;
            }
        } catch (e) {
            console.error('Error migrating message:', message.id, e.message);
        }
    }
    console.log(`Migrated ${migratedMessages} messages\n`);
} else {
    console.log('No legacy messages file found\n');
}

console.log('=== Migration Complete ===');
