'use strict';

const cls = require('./cls');

const DEFAULT_THRESHOLD = 1000;  // default timeout in ms
const MAX_ARRAY_SIZE = 250;

class SizedArray {
    constructor(max_size) {
        this.max_size = max_size;
        this.items = [];
        this.nextIndex = 0;
        this.iterationCount = 0;
    }

    push (item) {
        return this.items.push(item);
    }

    pop () {
        return this.items.pop();
    }

    [Symbol.iterator]() {
        var index = -1;
        var data  = this.items;

        return {
            next: () => ({ value: data[++index], done: !(index in data) })
        };
    };
}


// Simple tracing facility with elapsed timestamps, aggregates a series of entries
// into one log message.
class Trace {
    constructor(threshold_ms) {
        this.threshold_ms = threshold_ms ?? 0;
        this.traceEvents = new SizedArray(MAX_ARRAY_SIZE);
        this.fn = new SizedArray(MAX_ARRAY_SIZE);
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

    leave (message) {
        const func = this.fn.pop() ?? {label: '<underflow>', timestamp: Date.now()};
        const internal_label = message ?? func.label;
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

const dummy = new Trace();

// Returns a Proxy object that directs calls to either the trace object attached
// to the current request or a dummy trace object that does nothing.  This is
// useful for functions that might be called outside the context of a request.

// How do we get the request here
module.exports = new Proxy(dummy, {
    apply (target, thisArg, args, req) {
        const trace = req?.trace;

        if (trace) {
            return Reflect.apply(trace, thisArg, args);
        }
        // do nothing if there was no req.trace
    },

    get (target, key, receiver, req) {
        const trace = req?.trace;

        if (trace) {
            return Reflect.get(trace, key, receiver);
        }

        // return dummy object attr if no req.trace
        return Reflect.get(target, key, receiver);
    },

    set (obj, prop, value, req) {
        const trace = req?.trace;

        if (trace) {
            return Reflect.set(trace, prop, value);
        }

        // return dummy object attr if no req.trace
        this[prop] = Object.assign({});
        return Reflect.set(obj, prop, value);
    }
});

// Either functions as middleware that attaches a trace object with a default
// timeout to the request object OR returns a middleware function that attaches
// a trace object to an inbound request with the specified timeout.
module.exports.middleware = function (req_or_timeout, res, next) {
    // Are we being called as middleware?
    if (res) {
        req_or_timeout.trace ??= new Trace(DEFAULT_THRESHOLD);
        res.trace ??= req_or_timeout.trace;
        return next();
    }

    else {
        return (req, res, next) => {
            req.trace ??= new Trace(req_or_timeout);
            res.trace ??= req.trace;
            next();
        };
    }
};
