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

// A middleware function to attach a trace object to an inbound request
function traceMiddleware (threshold) {
    return (req, res, next) => {
        req.trace ??= new Trace(threshold);
        res.trace ??= req.trace;
        next();
    };
}

module.exports = traceMiddleware;

// A null trace object that does nothing.  This is useful for cases where a
// function is called by multiple endpoints and there may not be a trace object
// attached to the request for every call path.
const dummy = new Trace();  // dummy trace object
module.exports.dummy = new Proxy(dummy, {
    apply () {}  // do nothing...
});
