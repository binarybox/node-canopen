/** CANopen Sync producer.
 * @param {RawChannel} channel - socketcan RawChannel object.
 */
class Sync {
    constructor(channel) {
        this.channel = channel;
        this.timer = null;
        this.syncCount = 0;
    }

    /** Serve a Sync object to the channel.
     * @private
     */
    _sendSync() {
        this.syncCount += 1;
        this.channel.send({
            id: 0x0,
            ext: false,
            rtr: false,
            data: Buffer.from([this.syncCount]),
        });
    }

    /** Start serving Sync objects.
     * 
     * @param {number} syncTime - milliseconds between Sync objects.
     */
    start(syncTime) {
        this.timer = setInterval(()=>{ this._sendSync() }, syncTime);
    }

    /** Stop serving Sync objects. */
    stop() {
        clearInterval(this.timer);
    }
}

module.exports=exports=Sync;