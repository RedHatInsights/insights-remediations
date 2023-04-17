'use strict';

class Trace {
    constructor(scope) {
        this.traceEvents = [];
        this.fn = [];
        this.padding = '';

        this.enter(scope);
    }

    enter (label) {
        const func = typeof label === 'string' ? label : 'anonymous';

        this.fn.push(func);

        this.traceEvents.push({
            level: this.fn.length,
            timestamp: Date.now(),
            message: `${this.padding}Entered: ${func}`
        });

        this.padding = '  '.repeat(this.fn.length);
    }

    leave () {
        const func = this.fn.pop();
        this.padding = '  '.repeat(this.fn.length);

        this.traceEvents.push({
            level: this.fn.length,
            timestamp: Date.now(),
            message: `${this.padding}Exited: ${func}`
        });
    }

    event (message) {
        this.traceEvents.push({
            level: this.fn.length,
            timestamp: Date.now(),
            message: this.padding + message
        });
    }

    toString () {
        let message = '\n';
        let previousTimestamp = this.traceEvents[0]?.timestamp || 0;

        for (const event of this.traceEvents) {
            message += `(${event.timestamp - previousTimestamp})`.padEnd(7) + `${event.message}\n`;
        }

        return message;
    }
}

module.exports = Trace;
