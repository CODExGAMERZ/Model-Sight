/**
 * ModelSight Log Parser
 * Parses training logs to extract metrics like loss, accuracy, learning rate, GPU usage, and checkpoint events.
 */

/**
 * Parses a single log line for machine learning metrics.
 * Supports both JSON formats and key-value regex parsing.
 * 
 * @param {string} line - The raw log line.
 * @returns {object|null} - An object containing parsed metrics and timestamp, or null.
 */
function parseLine(line) {
    if (!line || typeof line !== 'string') return null;

    const metrics = {};
    let parsedJson = null;

    // 1. Try to parse JSON from the line
    const jsonStart = line.indexOf('{');
    if (jsonStart !== -1) {
        const jsonEnd = line.lastIndexOf('}');
        if (jsonEnd > jsonStart) {
            try {
                parsedJson = JSON.parse(line.substring(jsonStart, jsonEnd + 1));
            } catch (e) {
                // Ignore JSON parse errors and fallback to regex parsing
            }
        }
    }

    if (parsedJson && typeof parsedJson === 'object') {
        Object.assign(metrics, parsedJson);

        if (parsedJson.loss !== undefined && parsedJson.loss !== null) metrics.loss = parseFloat(parsedJson.loss);
        if (parsedJson.val_loss !== undefined && parsedJson.val_loss !== null) metrics.val_loss = parseFloat(parsedJson.val_loss);

        if (parsedJson.accuracy !== undefined && parsedJson.accuracy !== null) metrics.accuracy = parseFloat(parsedJson.accuracy);
        else if (parsedJson.acc !== undefined && parsedJson.acc !== null) metrics.accuracy = parseFloat(parsedJson.acc);

        if (parsedJson.val_accuracy !== undefined && parsedJson.val_accuracy !== null) metrics.val_accuracy = parseFloat(parsedJson.val_accuracy);
        else if (parsedJson.val_acc !== undefined && parsedJson.val_acc !== null) metrics.val_accuracy = parseFloat(parsedJson.val_acc);

        if (parsedJson.lr !== undefined && parsedJson.lr !== null) metrics.lr = parseFloat(parsedJson.lr);
        else if (parsedJson.learning_rate !== undefined && parsedJson.learning_rate !== null) metrics.lr = parseFloat(parsedJson.learning_rate);

        if (parsedJson.gpu_usage !== undefined && parsedJson.gpu_usage !== null) {
            metrics.gpu_usage = parseFloat(parsedJson.gpu_usage);
        } else if (parsedJson.gpu !== undefined && parsedJson.gpu !== null) {
            metrics.gpu_usage = parseFloat(parsedJson.gpu);
        }

        if (parsedJson.ram_usage !== undefined && parsedJson.ram_usage !== null) {
            metrics.ram_usage = parseFloat(parsedJson.ram_usage);
        } else if (parsedJson.ram !== undefined && parsedJson.ram !== null) {
            metrics.ram_usage = parseFloat(parsedJson.ram);
        }

        if (parsedJson.perplexity !== undefined && parsedJson.perplexity !== null) {
            metrics.perplexity = parseFloat(parsedJson.perplexity);
        }
        if (parsedJson.tokens_per_sec !== undefined && parsedJson.tokens_per_sec !== null) {
            metrics.tokens_per_sec = parseFloat(parsedJson.tokens_per_sec);
        }

        if (parsedJson.checkpoint !== undefined) {
            metrics.checkpoint = String(parsedJson.checkpoint);
        }
    }

    // 2. Regex fallbacks for Key-Value formats or unstructured logs
    // Check for loss
    if (metrics.loss === undefined) {
        const lossMatch = line.match(/\bloss[:=]\s*([0-9.e-]+)/i);
        if (lossMatch) metrics.loss = parseFloat(lossMatch[1]);
    }
    // Check for val loss
    if (metrics.val_loss === undefined) {
        const valLossMatch = line.match(/\b(val_loss)[:=]\s*([0-9.e-]+)/i);
        if (valLossMatch) metrics.val_loss = parseFloat(valLossMatch[2]);
    }
    // Check for accuracy
    if (metrics.accuracy === undefined) {
        const accMatch = line.match(/\b(accuracy|acc)[:=]\s*([0-9.]+)/i);
        if (accMatch) metrics.accuracy = parseFloat(accMatch[2]);
    }
    // Check for val accuracy
    if (metrics.val_accuracy === undefined) {
        const valAccMatch = line.match(/\b(val_accuracy|val_acc)[:=]\s*([0-9.]+)/i);
        if (valAccMatch) metrics.val_accuracy = parseFloat(valAccMatch[2]);
    }
    // Check for learning rate
    if (metrics.lr === undefined) {
        const lrMatch = line.match(/\b(lr|learning_rate)[:=]\s*([0-9.e-]+)/i);
        if (lrMatch) metrics.lr = parseFloat(lrMatch[2]);
    }
    // Check for GPU usage
    if (metrics.gpu_usage === undefined) {
        const gpuMatch = line.match(/\b(gpu_usage|gpu)[:=]\s*([0-9.]+)(%?)/i);
        if (gpuMatch) metrics.gpu_usage = parseFloat(gpuMatch[2]);
    }
    // Check for RAM usage
    if (metrics.ram_usage === undefined) {
        const ramMatch = line.match(/\b(ram_usage|ram)[:=]\s*([0-9.]+)(%?)/i);
        if (ramMatch) metrics.ram_usage = parseFloat(ramMatch[2]);
    }
    // Check for checkpoint saving
    if (metrics.checkpoint === undefined) {
        // e.g. checkpoint=saved, checkpoint saved, saving checkpoint, saved model to...
        const checkpointMatch = line.match(/\b(checkpoint[:=]\s*([a-zA-Z0-9_-]+)|saved\s+checkpoint|checkpoint\s+saved|saving\s+model|saved\s+model)\b/i);
        if (checkpointMatch) {
            metrics.checkpoint = checkpointMatch[2] || 'saved';
        }
    }

    // Return metrics if we found anything
    if (Object.keys(metrics).length > 0) {
        metrics.timestamp = Date.now();
        return metrics;
    }

    return null;
}

module.exports = {
    parseLine
};
