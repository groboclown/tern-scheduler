# About the Messaging API

The messaging API provides the ability to hook your own messaging bus (e.g. Rabbit MQ) into the Tern scheduler, to help reduce the server overhead of polling for events.

Currently, these internal service events cannot be triggered through the messaging system:

* Schedule creation
* Schedule lease obtained
* Schedule lease released

(Adding those in properly will require additional logic changes that aren't currently supported)

So the actions of identifying scheduled job lease repair must be done through a polling mechanism.

The scheduler uses a native NodeJS `EventEmitter` object to push events between systems.  The events are broken into groups inside the [messaging API source](api.ts).

