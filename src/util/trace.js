'use strict';

// Simple tracing facility with elapsed timestamps, aggregates a series of entries
// into one log message.
class Trace {
    constructor(threshold) {
        this.threshold_ms = threshold ?? 0;
        this.traceEvents = [];
        this.fn = [];
        this.initialTimestamp = Date.now();
        this.padding = '';
        this.force = false;
    }

    // Use enter() and leave() to group messages.  Useful for grouping by
    // function.
    enter (label) {
        const func = typeof label === 'string' ? label : 'anonymous';
        const now = Date.now();

        this.fn.push({
            timestamp: now,
            label: func
        });

        this.traceEvents.push({
            level: this.fn.length,
            timestamp: now,
            message: `${this.padding}Entered: ${func}`
        });

        this.padding = '  '.repeat(this.fn.length);
    }

    leave (label) {
        const func = this.fn.pop();
        const internal_label = label ?? func.label;
        const now = Date.now();
        this.padding = '  '.repeat(this.fn.length);

        this.traceEvents.push({
            level: this.fn.length,
            timestamp: now,
            message: `${this.padding}Left: ${internal_label} | (${now - func.timestamp})`
        });
    }

    // Add a timestamped message to the queue
    event (message) {
        this.traceEvents.push({
            level: this.fn.length,
            timestamp: Date.now(),
            message: this.padding + message
        });
    }

    // print accumulated messages with elapsed times
    toString () {
        let message = '\n';
        let previousTimestamp = this.initialTimestamp;
        let finalTimestamp = previousTimestamp;

        for (const event of this.traceEvents) {
            message += `(${event.timestamp - previousTimestamp})`.padEnd(7) + `${event.message}\n`;
            previousTimestamp = event.timestamp;
            finalTimestamp = event.timestamp;
        }

        message += `\nTotal Elapsed time: ${finalTimestamp - this.initialTimestamp}\n`;

        return message;
    }

    // print accumulated messages with elapsed times
    format () {
        let message = [];
        let previousTimestamp = this.initialTimestamp;
        let finalTimestamp = previousTimestamp;

        for (const event of this.traceEvents) {
            message.push(`(${event.timestamp - previousTimestamp})`.padEnd(7) + `${event.message}`);
            previousTimestamp = event.timestamp;
            finalTimestamp = event.timestamp;
        }

        return message;
    }

}

function traceMiddleware (threshold) {
    return (req, res, next) => {
        req.trace ??= new Trace(threshold);
        res.trace ??= req.trace;
        next();
    };
}

module.exports = traceMiddleware;

const null_trace = new Trace();  // dummy trace object
module.exports.null = new Proxy(null_trace, {
    apply () {},
});
