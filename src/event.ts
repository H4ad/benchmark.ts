export class Event {
  /**
   * The Event constructor.
   * @param type The event type.
   */
  constructor(type: string | Object) {
    if (typeof type == 'string') {
      this.timeStamp = Date.now();
      this.type = type;
    } else {
      Object.assign(this as any, type);
    }

    // var event = this;
    // if (type instanceof Event) {
    //   return type;
    // }
    // return (event instanceof Event)
    //   ? _.assign(event, { 'timeStamp': (+_.now()) }, typeof type == 'string' ? { 'type': type } : type)
    //   : new Event(type);
  }

  /**
   * A flag to indicate if the emitters listener iteration is aborted.
   */
  public aborted: boolean = false;

  /**
   * A flag to indicate if the default action is cancelled.
   */
  public cancelled: boolean = false;

  /**
   * The object whose listeners are currently being processed.
   */
  public currentTarget?: any = undefined;

  /**
   * The return value of the last executed listener.
   */
  public result?: unknown = undefined;

  /**
   * The object to which the event was originally emitted.
   */
  public target?: any = undefined;

  /**
   * A timestamp of when the event was created (ms).
   */
  public timeStamp: number = 0;

  /**
   * The event type.
   */
  public type: string = '';

  /**
   * The message of this event
   */
  public message: object | undefined;

}
