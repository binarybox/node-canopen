/**
 * @file Implements the CANopen Service Data Object (SDO) protocol.
 * @author Wilkins White
 * @copyright 2021 Nova Dynamics LLC
 */

const Device = require('../device');
const { ObjectType, AccessType, DataType, rawToType, typeToRaw, EdsError, DataObject } = require('../eds');

/**
 * CANopen abort codes.
 *
 * @enum {string}
 * @see CiA301 'Protocol SDO abort transfer' (§7.2.4.3.17)
 * @memberof SdoError
 */
const SdoCode = {
    /** Toggle bit not altered. */
    TOGGLE_BIT: 0x05030000,

    /** SDO protocol timed out. */
    TIMEOUT: 0x05040000,

    /** Command specifier not valid or unknown. */
    BAD_COMMAND: 0x05040001,

    /** Invalid block size in block mode. */
    BAD_BLOCK_SIZE: 0x05040002,

    /** Invalid sequence number in block mode. */
    BAD_BLOCK_SEQUENCE: 0x05040003,

    /** CRC error in block mode. */
    BAD_BLOCK_CRC: 0x05040004,

    /** Out of memory. */
    OUT_OF_MEMORY: 0x05040005,

    /** Unsupported access to an object. */
    UNSUPPORTED_ACCESS: 0x06010000,

    /** Attempt to read a write only object. */
    WRITE_ONLY: 0x06010001,

    /** Attempt to write a read only object. */
    READ_ONLY: 0x06010002,

    /** Object does not exist. */
    OBJECT_UNDEFINED: 0x06020000,

    /** Object cannot be mapped to the PDO. */
    OBJECT_NOT_MAPPABLE: 0x06040041,

    /** Number and length of object to be mapped exceeds PDO length. */
    MAP_LENGTH: 0x06040042,

    /** General parameter incompatibility reasons. */
    PARAMETER_INCOMPATIBILITY: 0x06040043,

    /** General internal incompatibility in device. */
    DEVICE_INCOMPATIBILITY: 0x06040047,

    /** Access failed due to hardware error. */
    HARDWARE_ERROR: 0x06060000,

    /** Data type does not match: length of service parameter does not match. */
    BAD_LENGTH: 0x06070010,

    /** Data type does not match: length of service parameter too high. */
    DATA_LONG: 0x06070012,

    /** Data type does not match: length of service parameter too short. */
    DATA_SHORT: 0x06070012,

    /** Sub index does not exist. */
    BAD_SUB_INDEX: 0x06090011,

    /** Invalid value for download parameter. */
    BAD_VALUE: 0x06090030,

    /** Value range of parameter written too high. */
    VALUE_HIGH: 0x06090031,

    /** Value range of parameter written too low. */
    VALUE_LOW: 0x06090032,

    /** Maximum value is less than minimum value. */
    RANGE_ERROR: 0x06090036,

    /** Resource not available: SDO connection. */
    SDO_NOT_AVAILBLE: 0x060A0023,

    /** General error. */
    GENERAL_ERROR: 0x08000000,

    /** Data cannot be transferred or stored to application. */
    DATA_TRANSFER: 0x08000020,

    /**
     * Data cannot be transferred or stored to application because of local
     * control
     */
    LOCAL_CONTROL: 0x08000021,

    /**
     * Data cannot be transferred or stored to application because of present
     * device state.
     */
    DEVICE_STATE: 0x08000022,

    /** Object dictionary not present or dynamic generation failed. */
    OD_ERROR: 0x08000023,

    /** No data available. */
    NO_DATA: 0x08000024,
};

/**
 * CANopen SDO 'Client Command Specifier' codes.
 *
 * @enum {number}
 * @see CiA301 'SDO protocols' (§7.2.4.3)
 * @private
 */
const ClientCommand = {
    DOWNLOAD_SEGMENT: 0,
    DOWNLOAD_INITIATE: 1,
    UPLOAD_INITIATE: 2,
    UPLOAD_SEGMENT: 3,
    ABORT: 4,
};

/**
 * CANopen SDO 'Server Command Specifier' codes.
 *
 * @enum {number}
 * @see CiA301 'SDO protocols' (§7.2.4.3)
 * @private
 */
const ServerCommand = {
    UPLOAD_SEGMENT: 0,
    DOWNLOAD_SEGMENT: 1,
    UPLOAD_INITIATE: 2,
    DOWNLOAD_INITIATE: 3,
    ABORT: 4,
};

/**
 * Return the error message associated with an AbortCode.
 *
 * @param {SdoCode} code - message to lookup.
 * @returns {string} abort code string.
 * @private
 */
function codeToString(code) {
    switch(code) {
        case SdoCode.TOGGLE_BIT:
            return 'Toggle bit not altered';
        case SdoCode.TIMEOUT:
            return 'SDO protocol timed out';
        case SdoCode.BAD_COMMAND:
            return 'Command specifier not valid or unknown';
        case SdoCode.BAD_BLOCK_SIZE:
            return 'Invalid block size in block mode';
        case SdoCode.BAD_BLOCK_SEQUENCE:
            return 'Invalid sequence number in block mode';
        case SdoCode.BAD_BLOCK_CRC:
            return 'CRC error in block mode';
        case SdoCode.OUT_OF_MEMORY:
            return 'Out of memory';
        case SdoCode.UNSUPPORTED_ACCESS:
            return 'Unsupported access to an object';
        case SdoCode.WRITE_ONLY:
            return 'Attempt to read a write only object'
        case SdoCode.READ_ONLY:
            return 'Attempt to write a read only object';
        case SdoCode.OBJECT_UNDEFINED:
            return 'Object does not exist';
        case SdoCode.OBJECT_NOT_MAPPABLE:
            return 'Object cannot be mapped to the PDO';
        case SdoCode.MAP_LENGTH:
            return 'Number and length of object to be mapped exceeds PDO length';
        case SdoCode.PARAMETER_INCOMPATIBILITY:
            return 'General parameter incompatibility reasons';
        case SdoCode.DEVICE_INCOMPATIBILITY:
            return 'General internal incompatibility in device';
        case SdoCode.HARDWARE_ERROR:
            return 'Access failed due to hardware error';
        case SdoCode.BAD_LENGTH:
            return 'Data type does not match: length of service parameter does not match';
        case SdoCode.DATA_LONG:
            return 'Data type does not match: length of service parameter too high';
        case SdoCode.DATA_SHORT:
            return 'Data type does not match: length of service parameter too short';
        case SdoCode.BAD_SUB_INDEX:
            return 'Sub index does not exist';
        case SdoCode.BAD_VALUE:
            return 'Invalid value for download parameter';
        case SdoCode.VALUE_HIGH:
            return 'Value range of parameter written too high';
        case SdoCode.VALUE_LOW:
            return 'Value range of parameter written too low';
        case SdoCode.RANGE_ERROR:
            return 'Maximum value is less than minimum value';
        case SdoCode.SDO_NOT_AVAILBLE:
            return 'Resource not available: SDO connection';
        case SdoCode.GENERAL_ERROR:
            return 'General error';
        case SdoCode.DATA_TRANSFER:
            return 'Data cannot be transferred or stored to application';
        case SdoCode.LOCAL_CONTROL:
            return 'Data cannot be transferred or stored to application because of local control';
        case SdoCode.DEVICE_STATE:
            return 'Data cannot be transferred or stored to application because of present device state';
        case SdoCode.OD_ERROR:
            return 'Object dictionary not present or dynamic generation failed';
        case SdoCode.NO_DATA:
            return 'No data available';
        default:
            return 'Unknown error';
    }
}

/**
 * Represents an SDO transfer error.
 *
 * @param {SdoCode} code - error code.
 * @param {number} index - object index.
 * @param {number} subIndex - object subIndex.
 */
class SdoError extends Error {
    constructor(code, index, subIndex=null) {
        const message = codeToString(code);

        let tag = index
        if (typeof index === 'number')
            tag = `0x${index.toString(16)}`;
        if(subIndex !== null)
            tag += `.${subIndex.toString()}`;

        super(`${message} [${tag}]`);

        this.code = code;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Represents an SDO transfer.
 *
 * @memberof SdoClient
 * @private
 */
class Transfer {
    constructor(args) {
        const {
            device,
            resolve,
            reject,
            index,
            subIndex,
            data,
            timeout,
            cobId,
        } = args;

        this._resolve = resolve;
        this._reject = reject;

        this.device = device;
        this.index = index;
        this.subIndex = subIndex;
        this.timeout = timeout;
        this.cobId = cobId;
        this.data = (data) ? data : Buffer.alloc(0);
        this.size = this.data.length;

        this.active = false;
        this.toggle = 0;
        this.timer = null;
    }

    /** Begin the transfer timeout. */
    start() {
        this.active = true;
        if(this.timeout) {
            this.timer = setTimeout(() => {
                this.abort(SdoCode.TIMEOUT);
            }, this.timeout);
        }
    }

    /** Refresh the transfer timeout. */
    refresh() {
        if(!this.timeout)
            return;

        this.timer.refresh();
    }

    /**
     * Send a data buffer.
     *
     * @param {Buffer} data - data to send.
     */
    send(data) {
        this.device.send({
            id:     this.cobId,
            data:   data,
        });
    }

    /**
     * Complete the transfer and resolve its promise.
     *
     * @param {Buffer | undefined} data - return data.
     */
    resolve(data) {
        this.active = false;
        clearTimeout(this.timer);
        if(this._resolve)
            this._resolve(data);
    }

    /**
     * Complete the transfer and reject its promise.
     *
     * @param {SdoCode} code - SDO abort code.
     */
    reject(code) {
        this.active = false;
        clearTimeout(this.timer);
        if(this._reject)
            this._reject(new SdoError(code, this.index, this.subIndex));
    }

    /**
     * Abort the transfer.
     *
     * @param {SdoCode} code - SDO abort code.
     */
    abort(code) {
        const sendBuffer = Buffer.alloc(8);
        sendBuffer.writeUInt8(0x80, 0);
        sendBuffer.writeUInt16LE(this.index, 1);
        sendBuffer.writeUInt8(this.subIndex, 3);
        sendBuffer.writeUInt32LE(code, 4);

        this.send(sendBuffer);
        this.reject(code);
    }
}

/**
 * Queue of pending transfers.
 *
 * @see https://medium.com/@karenmarkosyan/how-to-manage-promises-into-dynamic-queue-with-vanilla-javascript-9d0d1f8d4df5
 * @memberof SdoClient
 * @private
 */
class Queue {
    constructor() {
        this.queue = [];
        this.pending = false;
    }

    /**
     * Add a transfer to the queue.
     *
     * @param {Function} start - start the transfer.
     */
    push(start) {
        return new Promise((resolve, reject) => {
            this.queue.push({ start, resolve, reject });
            this.pop();
        });
    }

    /** Run the next transfer in queue. */
    pop() {
        if(this.pending)
            return;

        const transfer = this.queue.shift();
        if(!transfer)
            return;

        this.pending = true;
        transfer.start().then((value) => {
            this.pending = false;
            transfer.resolve(value);
            this.pop();
        })
        .catch((error) => {
            this.pending = false;
            transfer.reject(error);
            this.pop();
        });
    }
}

/**
 * CANopen SDO protocol handler (Client).
 *
 * The service data object (SDO) protocol uses a client-server structure where
 * a client can initiate the transfer of data from the server's object
 * dictionary. An SDO is transfered as a sequence of segments with basic
 * error checking.
 *
 * @param {Device} device - parent device.
 * @see CiA301 'Service data object (SDO)' (§7.2.4)
 * @protected
 */
class SdoClient {
    constructor(device) {
        this.device = device;
        this.servers = {};
        this.transfers = {};
    }

    /**
     * Get an SDO client parameter entry.
     *
     * @param {number} serverId - server COB-ID of the entry to get.
     * @returns {DataObject | null} the matching entry.
     */
    getServer(serverId) {
        for(let [index, entry] of Object.entries(this.device.dataObjects)) {
            index = parseInt(index);
            if(index < 0x1280 || index > 0x12FF)
                continue;

            if(entry[3] !== undefined && entry[3].value === serverId)
                return entry;
        }

        return null;
    }

    /**
     * Add an SDO client parameter entry.
     *
     * @param {number} serverId - server COB-ID to add.
     * @param {number} cobIdTx - Sdo COB-ID for outgoing messages (to server).
     * @param {number} cobIdRx - Sdo COB-ID for incoming messages (from server).
     */
    addServer(serverId, cobIdTx=0x600, cobIdRx=0x580) {
        if(serverId < 1 || serverId > 0x7F)
            throw RangeError('serverId must be in range 1-127');

        if(this.getServer(serverId) !== null) {
            serverId = '0x' + serverId.toString(16);
            throw new EdsError(`Entry for server ${serverId} already exists`);
        }

        let index = 0x1280;
        for(; index <= 0x12FF; ++index) {
            if(this.device.eds.getEntry(index) === undefined)
                break;
        }

        this.device.eds.addEntry(index, {
            parameterName:  'SDO client parameter',
            objectType:     ObjectType.RECORD,
        });

        this.device.eds.addSubEntry(index, 1, {
            parameterName:  'COB-ID client to server',
            dataType:       DataType.UNSIGNED32,
            accessType:     AccessType.READ_WRITE,
            defaultValue:   cobIdTx
        });

        this.device.eds.addSubEntry(index, 2, {
            parameterName:  'COB-ID server to client',
            dataType:       DataType.UNSIGNED32,
            accessType:     AccessType.READ_WRITE,
            defaultValue:   cobIdRx
        });

        this.device.eds.addSubEntry(index, 3, {
            parameterName:  'Node-ID of the SDO server',
            dataType:       DataType.UNSIGNED8,
            accessType:     AccessType.READ_WRITE,
            defaultValue:   serverId
        });
    }

    /**
     * Remove an SDO client parameter entry.
     *
     * @param {number} serverId - server COB-ID of the entry to remove.
     */
    removeServer(serverId) {
        const entry = this.getServer(serverId);
        if(entry === null)
            throw ReferenceError(`Entry for server ${serverId} does not exist`);

        this.device.eds.removeEntry(entry.index);
    }

    /** Initialize members and begin serving SDO transfers. */
    init() {
        for(let [index, entry] of Object.entries(this.device.dataObjects)) {
            index = parseInt(index);
            if(index < 0x1280 || index > 0x12FF)
                continue;

            /* Object 0x1280..0x12FF - SDO client parameter.
             *   sub-index 1/2:
             *     bit 0..10      11-bit CAN base frame.
             *     bit 11..28     29-bit CAN extended frame.
             *     bit 29         Frame type (base or extended).
             *     bit 30         Dynamically allocated.
             *     bit 31         SDO exists / is valid.
             *
             *   sub-index 3:
             *     bit 0..7      Node-ID of the SDO server.
             */
            const serverId = entry[3].value;
            if(!serverId)
                throw new ReferenceError('ID of the SDO server is required.');

            let cobIdTx = entry[1].value;
            if(!cobIdTx || ((cobIdTx >> 31) & 0x1) == 0x1)
                continue;

            if(((cobIdTx >> 30) & 0x1) == 0x1)
                throw TypeError('Dynamic assignment is not supported.');

            if(((cobIdTx >> 29) & 0x1) == 0x1)
                throw TypeError('CAN extended frames are not supported.');

            cobIdTx &= 0x7FF;
            if((cobIdTx & 0xF) == 0x0)
                cobIdTx |= serverId;

            let cobIdRx = entry[2].value;
            if(!cobIdRx || ((cobIdRx >> 31) & 0x1) == 0x1)
                continue;

            if(((cobIdRx >> 30) & 0x1) == 0x1)
                throw TypeError('Dynamic assignment is not supported.');

            if(((cobIdRx >> 29) & 0x1) == 0x1)
                throw TypeError('CAN extended frames are not supported.');

            cobIdRx &= 0x7FF;
            if((cobIdRx & 0xF) == 0x0)
                cobIdRx |= serverId;

            this.servers[serverId] = {
                cobIdTx:    cobIdTx,
                cobIdRx:    cobIdRx,
                queue:      new Queue(),
            };
        }

        this.device.addListener('message', this._onMessage.bind(this));
    }

    /**
     * Service: SDO upload
     *
     * Read data from an SDO server.
     *
     * @param {object} args - arguments to destructure.
     * @param {number} args.serverId - SDO server.
     * @param {number} args.index - data index to upload.
     * @param {number} args.subIndex - data subIndex to upload.
     * @param {number} args.timeout - time before transfer is aborted.
     * @param {DataType} args.dataType - expected data type.
     * @returns {Promise<Buffer | number | bigint | string | Date>} resolves when the upload is complete.
     */
    upload({serverId, index, subIndex=null, timeout=30, dataType=null}) {
        let server = this.servers[serverId];
        if(server === undefined) {
            // Attempt to use default server
            if(this.servers[0] === undefined) {
                const id = serverId.toString(16);
                throw new ReferenceError(`SDO server 0x${id} not mapped.`);
            }

            let cobIdRx = this.servers[0].cobIdRx;
            if((cobIdRx & 0xF) == 0x0)
                cobIdRx |= serverId

            let cobIdTx = this.servers[0].cobIdTx;
            if((cobIdTx & 0xF) == 0x0)
                cobIdTx |= serverId

            server = this.servers[serverId] = {
                cobIdRx:    cobIdRx,
                cobIdTx:    cobIdTx,
                pending:    {},
                queue:      new Queue(),
            };
        }

        if(index === undefined)
            throw ReferenceError("Must provide an index.");

        return server.queue.push(() => {
            return new Promise((resolve, reject) => {
                this.transfers[server.cobIdRx] = new Transfer({
                    device:     this.device,
                    resolve:    resolve,
                    reject:     reject,
                    index:      index,
                    subIndex:   subIndex,
                    timeout:    timeout,
                    cobId:      server.cobIdTx,
                });

                const sendBuffer = Buffer.alloc(8);
                sendBuffer.writeUInt8(ClientCommand.UPLOAD_INITIATE << 5);
                sendBuffer.writeUInt16LE(index, 1);
                sendBuffer.writeUInt8(subIndex, 3);

                this.transfers[server.cobIdRx].start();

                this.device.send({
                    id:     server.cobIdTx,
                    data:   sendBuffer
                });
            })
        })
        .then((data) => {
            return rawToType(data, dataType);
        })
    }

    /**
     * Service: SDO download.
     *
     * Write data to an SDO server.
     *
     * @param {object} args - arguments to destructure.
     * @param {number} args.serverId - SDO server.
     * @param {object} args.data - data to download.
     * @param {number} args.index - index or name to download to.
     * @param {number} args.subIndex - data subIndex to download to.
     * @param {number} args.timeout - time before transfer is aborted.
     * @param {DataType} args.dataType - type of data to download.
     * @returns {Promise} resolves when the download is complete.
     */
    download({serverId, data, index, subIndex=null, timeout=30, dataType=null}) {
        let server = this.servers[serverId];
        if(server === undefined) {
            // Attempt to use default server
            if(this.servers[0] === undefined) {
                const id = serverId.toString(16);
                throw new ReferenceError(`SDO server 0x${id} not mapped.`);
            }

            let cobIdRx = this.servers[0].cobIdRx;
            if((cobIdRx & 0xF) == 0x0)
                cobIdRx |= serverId

            let cobIdTx = this.servers[0].cobIdTx;
            if((cobIdTx & 0xF) == 0x0)
                cobIdTx |= serverId

            server = this.servers[serverId] = {
                cobIdRx:    cobIdRx,
                cobIdTx:    cobIdTx,
                pending:    Promise.resolve(),
                queue:      new Queue(),
            };
        }

        if(index === undefined)
            throw ReferenceError("Must provide an index.");

        if(!Buffer.isBuffer(data)) {
            if(!dataType)
                throw ReferenceError("Must provide dataType.");

            data = typeToRaw(data, dataType);
            if(data === undefined)
                throw TypeError(`Failed to convert data to type ${dataType}`);
        }

        return server.queue.push(() => {
            return new Promise((resolve, reject) => {
                this.transfers[server.cobIdRx] = new Transfer({
                    device:     this.device,
                    resolve:    resolve,
                    reject:     reject,
                    index:      index,
                    subIndex:   subIndex,
                    data:       data,
                    timeout:    timeout,
                    cobId:      server.cobIdTx,
                });

                const sendBuffer = Buffer.alloc(8);
                let header = (ClientCommand.DOWNLOAD_INITIATE << 5);

                sendBuffer.writeUInt16LE(index, 1);
                sendBuffer.writeUInt8(subIndex, 3);

                if(data.length > 4) {
                    // Segmented transfer
                    sendBuffer.writeUInt8(header | 0x1);
                    sendBuffer.writeUInt32LE(data.length, 4);
                }
                else {
                    // Expedited transfer
                    header |= ((4-data.length) << 2) | 0x3;

                    sendBuffer.writeUInt8(header);
                    data.copy(sendBuffer, 4);
                }

                this.transfers[server.cobIdRx].start();

                this.device.send({
                    id:     server.cobIdTx,
                    data:   sendBuffer
                });
            });
        });
    }

    /**
     * Handle SCS.UPLOAD_INITIATE.
     *
     * @param {Transfer} transfer - SDO context.
     * @param {Buffer} data - message data.
     * @private
     */
    _uploadInitiate(transfer, data) {
        if(data[0] & 0x02) {
            // Expedited transfer
            const size = (data[0] & 1) ? (4 - ((data[0] >> 2) & 3)) : 4;
            transfer.resolve(data.slice(4, 4 + size));
        }
        else {
            // Segmented transfer
            const sendBuffer = Buffer.alloc(8);
            sendBuffer.writeUInt8(ClientCommand.UPLOAD_SEGMENT << 5);

            if(data[0] & 0x1)
                transfer.size = data.readUInt32LE(4);

            transfer.send(sendBuffer);
            transfer.refresh();
        }
    }

    /**
     * Handle SCS.UPLOAD_SEGMENT.
     *
     * @param {Transfer} transfer - SDO context.
     * @param {Buffer} data - message data.
     * @private
     */
    _uploadSegment(transfer, data) {
        if(!transfer.active)
            return;

        if((data[0] & 0x10) != (transfer.toggle << 4)) {
            transfer.abort(SdoCode.TOGGLE_BIT);
            return;
        }

        const count = (7 - ((data[0] >> 1) & 0x7));
        const payload = data.slice(1, count+1);
        const size = transfer.data.length + count;
        const buffer = Buffer.concat([transfer.data, payload], size);

        if(data[0] & 1) {
            if(transfer.size != size) {
                transfer.abort(SdoCode.BAD_LENGTH);
                return;
            }

            transfer.resolve(buffer);
        }
        else {
            transfer.toggle ^= 1;
            transfer.data = buffer;

            const sendBuffer = Buffer.alloc(8);
            const header = (ClientCommand.UPLOAD_SEGMENT << 5) | (transfer.toggle << 4);
            sendBuffer.writeUInt8(header);

            transfer.send(sendBuffer);
            transfer.refresh();
        }
    }

    /**
     * Handle SCS.DOWNLOAD_INITIATE.
     *
     * @param {Transfer} transfer - SDO context.
     * @private
     */
    _downloadInitiate(transfer) {
        if(transfer.size <= 4) {
            /* Expedited transfer. */
            transfer.resolve();
            return;
        }

        const sendBuffer = Buffer.alloc(8);
        transfer.size = Math.min(7, transfer.data.length);
        transfer.data.copy(sendBuffer, 1, 0, transfer.size);

        let header = (ClientCommand.DOWNLOAD_SEGMENT << 5) | ((7-transfer.size) << 1);
        if(transfer.data.length == transfer.size)
            header |= 1;

        sendBuffer.writeUInt8(header);

        transfer.send(sendBuffer);
        transfer.refresh();
    }

    /**
     * Handle SCS.DOWNLOAD_SEGMENT.
     *
     * @param {Transfer} transfer - SDO context.
     * @param {Buffer} data - message data.
     * @private
     */
    _downloadSegment(transfer, data) {
        if(!transfer.active)
            return;

        if((data[0] & 0x10) != (transfer.toggle << 4)) {
            transfer.abort(SdoCode.TOGGLE_BIT);
            return;
        }

        if(transfer.size == transfer.data.length) {
            transfer.resolve();
            return;
        }

        const sendBuffer = Buffer.alloc(8);
        const count = Math.min(7, (transfer.data.length - transfer.size));

        transfer.data.copy(
            sendBuffer, 1, transfer.size, transfer.size + count);

        transfer.toggle ^= 1;
        transfer.size += count;

        let header = (ClientCommand.DOWNLOAD_SEGMENT << 5)
                   | (transfer.toggle << 4)
                   | ((7-count) << 1);

        if(transfer.size == transfer.data.length)
            header |= 1;

        sendBuffer.writeUInt8(header);

        transfer.send(sendBuffer);
        transfer.refresh();
    }

    /**
     * Called when a new CAN message is received.
     *
     * @param {object} message - CAN frame.
     * @param {number} message.id - CAN message identifier.
     * @param {Buffer} message.data - CAN message data;
     * @param {number} message.len - CAN message length in bytes.
     * @private
     */
    _onMessage(message) {
        // Handle transfers as a client (remote object dictionary)
        const transfer = this.transfers[message.id];
        if(transfer === undefined)
            return;

        switch(message.data[0] >> 5) {
            case ServerCommand.UPLOAD_SEGMENT:
                this._uploadSegment(transfer, message.data);
                break;
            case ServerCommand.DOWNLOAD_SEGMENT:
                this._downloadSegment(transfer, message.data);
                break;
            case ServerCommand.UPLOAD_INITIATE:
                this._uploadInitiate(transfer, message.data);
                break;
            case ServerCommand.DOWNLOAD_INITIATE:
                this._downloadInitiate(transfer);
                break;
            case ServerCommand.ABORT:
                transfer.abort(message.data.readUInt32LE(4));
                break;
            default:
                transfer.abort(SdoCode.BAD_COMMAND);
                break;
        }
    }
}

/**
 * CANopen SDO protocol handler (Server).
 *
 * The service data object (SDO) protocol uses a client-server structure where
 * a client can initiate the transfer of data from the server's object
 * dictionary. An SDO is transfered as a sequence of segments with basic
 * error checking.
 *
 * @param {Device} device - parent device.
 * @see CiA301 'Service data object (SDO)' (§7.2.4)
 * @protected
 */
class SdoServer {
    constructor(device) {
        this.device = device;
        this.clients = {};
    }

    /**
     * Get an SDO server parameter entry.
     *
     * @param {number} clientId - client COB-ID of the entry to get.
     * @returns {DataObject | null} the matching entry.
     */
    getClient(clientId) {
        for(let [index, entry] of Object.entries(this.device.dataObjects)) {
            index = parseInt(index);
            if(index < 0x1200 || index > 0x127F)
                continue;

            if(entry[3] !== undefined && entry[3].value === clientId)
                return entry;
        }

        return null;
    }

    /**
     * Add an SDO server parameter entry.
     *
     * @param {number} clientId - client COB-ID to add.
     * @param {number} cobIdTx - Sdo COB-ID for outgoing messages (to client).
     * @param {number} cobIdRx - Sdo COB-ID for incoming messages (from client).
     */
    addClient(clientId, cobIdTx=0x580, cobIdRx=0x600) {
        if(clientId < 1 || clientId > 0x7F)
            throw RangeError('clientId must be in range 1-127');

        if(this.getClient(clientId) !== null) {
            clientId = '0x' + clientId.toString(16);
            throw new EdsError(`Entry for client ${clientId} already exists`);
        }

        let index = 0x1200;
        for(; index <= 0x127F; ++index) {
            if(this.device.eds.getEntry(index) === undefined)
                break;
        }

        this.device.eds.addEntry(index, {
            parameterName:  'SDO server parameter',
            objectType:     ObjectType.RECORD,
        });

        this.device.eds.addSubEntry(index, 1, {
            parameterName:  'COB-ID client to server',
            dataType:       DataType.UNSIGNED32,
            accessType:     AccessType.READ_WRITE,
            defaultValue:   cobIdRx
        });

        this.device.eds.addSubEntry(index, 2, {
            parameterName:  'COB-ID server to client',
            dataType:       DataType.UNSIGNED32,
            accessType:     AccessType.READ_WRITE,
            defaultValue:   cobIdTx
        });

        this.device.eds.addSubEntry(index, 3, {
            parameterName:  'Node-ID of the SDO client',
            dataType:       DataType.UNSIGNED8,
            accessType:     AccessType.READ_WRITE,
            defaultValue:   clientId
        });
    }

    /**
     * Remove an SDO server parameter entry.
     *
     * @param {number} clientId - client COB-ID of the entry to remove.
     */
    removeClient(clientId) {
        const entry = this.getClient(clientId);
        if(entry === null)
            throw ReferenceError(`Entry for client ${clientId} does not exist`);

        this.device.eds.removeEntry(entry.index);
    }

    /** Initialize members and begin serving SDO transfers. */
    init() {
        for(let [index, entry] of Object.entries(this.device.dataObjects)) {
            index = parseInt(index);
            if(index < 0x1200 || index > 0x127F)
                continue;

            /* Object 0x1200..0x127F - SDO server parameter.
             *   sub-index 1/2:
             *     bit 0..10      11-bit CAN base frame.
             *     bit 11..28     29-bit CAN extended frame.
             *     bit 29         Frame type (base or extended).
             *     bit 30         Dynamically allocated.
             *     bit 31         SDO exists / is valid.
             *
             *   sub-index 3 (optional):
             *     bit 0..7      Node-ID of the SDO client.
             */
            let cobIdRx = entry[1].value;
            if(!cobIdRx || ((cobIdRx >> 31) & 0x1) == 0x1)
                continue;

            if(((cobIdRx >> 30) & 0x1) == 0x1)
                throw TypeError('Dynamic assignment is not supported.');

            if(((cobIdRx >> 29) & 0x1) == 0x1)
                throw TypeError('CAN extended frames are not supported.');

            cobIdRx &= 0x7FF;
            if((cobIdRx & 0xF) == 0x0)
                cobIdRx |= this.device.id;

            let cobIdTx = entry[2].value;
            if(!cobIdTx || ((cobIdTx >> 31) & 0x1) == 0x1)
                continue;

            if(((cobIdTx >> 30) & 0x1) == 0x1)
                throw TypeError('Dynamic assignment is not supported.');

            if(((cobIdTx >> 29) & 0x1) == 0x1)
                throw TypeError('CAN extended frames are not supported.');

            cobIdTx &= 0x7FF;
            if((cobIdTx & 0xF) == 0x0)
                cobIdTx |= this.device.id;

            this.clients[cobIdRx] = new Transfer({
                device: this.device,
                cobId: cobIdTx
            });
        }

        this.device.addListener('message', this._onMessage.bind(this));
    }

    /**
     * Handle CCS.DOWNLOAD_INITIATE.
     *
     * @param {Transfer} client - SDO context.
     * @param {Buffer} data - message data.
     * @private
     */
    _downloadInitiate(client, data) {
        client.index = data.readUInt16LE(1);
        client.subIndex = data.readUInt8(3);

        if(data[0] & 0x02) {
            // Expedited client
            let entry = this.device.eds.getEntry(client.index);
            if(entry === undefined) {
                client.abort(SdoCode.OBJECT_UNDEFINED);
                return;
            }

            if(entry.subNumber > 0) {
                entry = entry[client.subIndex];
                if(entry === undefined) {
                    client.abort(SdoCode.BAD_SUB_INDEX);
                    return;
                }
            }

            if(entry.accessType == AccessType.CONSTANT
            || entry.accessType == AccessType.READ_ONLY) {
                client.abort(SdoCode.READ_ONLY);
                return;
            }

            const count = (data[0] & 1) ? (4 - ((data[0] >> 2) & 3)) : 4;
            const raw = Buffer.alloc(count);
            data.copy(raw, 0, 4, count+4);

            const value = rawToType(raw, entry.dataType);
            if(entry.highLimit !== undefined && value > entry.highLimit) {
                client.abort(SdoCode.VALUE_HIGH);
                return;
            }

            if(entry.lowLimit !== undefined && value < entry.lowLimit) {
                client.abort(SdoCode.VALUE_LOW);
                return;
            }

            entry.raw = raw;

            const sendBuffer = Buffer.alloc(8);
            sendBuffer.writeUInt8(ServerCommand.DOWNLOAD_INITIATE << 5);
            sendBuffer.writeUInt16LE(client.index, 1);
            sendBuffer.writeUInt8(client.subIndex, 3);

            this.device.send({
                id:     client.cobId,
                data:   sendBuffer,
            });
        }
        else {
            // Segmented client
            client.data = Buffer.alloc(0);
            client.size = 0;
            client.toggle = 0;

            const sendBuffer = Buffer.alloc(8);
            sendBuffer.writeUInt8(ServerCommand.DOWNLOAD_INITIATE << 5);
            sendBuffer.writeUInt16LE(client.index, 1);
            sendBuffer.writeUInt8(client.subIndex, 3);

            this.device.send({
                id:     client.cobId,
                data:   sendBuffer,
            });

            client.start();
        }
    }

    /**
     * Handle CCS.UPLOAD_INITIATE.
     *
     * @param {Transfer} client - SDO context.
     * @param {Buffer} data - message data.
     * @private
     */
    _uploadInitiate(client, data) {
        client.index = data.readUInt16LE(1);
        client.subIndex = data.readUInt8(3);

        let entry = this.device.eds.getEntry(client.index);
        if(entry === undefined) {
            client.abort(SdoCode.OBJECT_UNDEFINED);
            return;
        }

        if(entry.subNumber > 0) {
            entry = entry[client.subIndex];
            if(entry === undefined) {
                client.abort(SdoCode.BAD_SUB_INDEX);
                return;
            }
        }

        if(entry.accessType == AccessType.WRITE_ONLY) {
            client.abort(SdoCode.WRITE_ONLY);
            return;
        }

        if(entry.size <= 4) {
            // Expedited client
            const sendBuffer = Buffer.alloc(8);
            const header = (ServerCommand.UPLOAD_INITIATE << 5)
                         | ((4-entry.size) << 2)
                         | 0x2;

            sendBuffer.writeUInt8(header, 0);
            sendBuffer.writeUInt16LE(client.index, 1);
            sendBuffer.writeUInt8(client.subIndex, 3);

            entry.raw.copy(sendBuffer, 4);

            if(entry.size < 4)
                sendBuffer[0] |= ((4 - entry.size) << 2) | 0x1;

            this.device.send({
                id:     client.cobId,
                data:   sendBuffer,
            });
        }
        else {
            // Segmented client
            client.data = Buffer.from(entry.raw);
            client.size = 0;
            client.toggle = 0;

            const sendBuffer = Buffer.alloc(8);
            const header = (ServerCommand.UPLOAD_INITIATE << 5) | 0x1;

            sendBuffer.writeUInt8(header, 0);
            sendBuffer.writeUInt16LE(client.index, 1);
            sendBuffer.writeUInt8(client.subIndex, 3);
            sendBuffer.writeUInt32LE(client.data.length, 4);

            this.device.send({
                id:     client.cobId,
                data:   sendBuffer,
            });

            client.start();
        }
    }

    /**
     * Handle CCS.UPLOAD_SEGMENT.
     *
     * @param {Transfer} client - SDO context.
     * @param {Buffer} data - message data.
     * @private
     */
    _uploadSegment(client, data) {
        if((data[0] & 0x10) != (client.toggle << 4)) {
            client.abort(SdoCode.TOGGLE_BIT);
            return;
        }

        const sendBuffer = Buffer.alloc(8);
        let count = Math.min(7, (client.data.length - client.size));
        client.data.copy(
            sendBuffer, 1, client.size, client.size + count);

        let header = (client.toggle << 4) | (7-count) << 1;
        if(client.size == client.data.length) {
            header |= 1;
            client.resolve();
        }

        sendBuffer.writeUInt8(header, 0);
        client.toggle ^= 1;
        client.size += count;

        this.device.send({
            id:     client.cobId,
            data:   sendBuffer,
        });

        client.refresh();
    }

    /**
     * Handle CCS.DOWNLOAD_SEGMENT.
     *
     * @param {Transfer} client - SDO context.
     * @param {Buffer} data - message data.
     * @private
     */
    _downloadSegment(client, data) {
        if((data[0] & 0x10) != (client.toggle << 4)) {
            client.abort(SdoCode.TOGGLE_BIT);
            return;
        }

        const count = (7 - ((data[0] >> 1) & 0x7));
        const payload = data.slice(1, count+1);
        const size = client.data.length + count;

        client.data = Buffer.concat([client.data, payload], size);

        if(data[0] & 1) {
            let entry = this.device.eds.getEntry(client.index);
            if(entry === undefined) {
                client.abort(SdoCode.OBJECT_UNDEFINED);
                return;
            }

            if(entry.subNumber > 0) {
                entry = entry[client.subIndex];
                if(entry === undefined) {
                    client.abort(SdoCode.BAD_SUB_INDEX);
                    return;
                }
            }

            if(entry.accessType == AccessType.CONSTANT
            || entry.accessType == AccessType.READ_ONLY) {
                client.abort(SdoCode.READ_ONLY);
                return;
            }

            const raw = Buffer.alloc(size);
            client.data.copy(raw);

            const value = rawToType(raw, entry.dataType);
            if(entry.highLimit !== undefined && value > entry.highLimit) {
                client.abort(SdoCode.VALUE_HIGH);
                return;
            }

            if(entry.lowLimit !== undefined && value < entry.lowLimit) {
                client.abort(SdoCode.VALUE_LOW);
                return;
            }

            entry.raw = raw;

            client.resolve();
        }

        const sendBuffer = Buffer.alloc(8);
        const header = (ServerCommand.DOWNLOAD_SEGMENT << 5) | (client.toggle << 4);

        sendBuffer.writeUInt8(header);
        client.toggle ^= 1;

        this.device.send({
            id:     client.cobId,
            data:   sendBuffer,
        });

        client.refresh();
    }

    /**
     * Called when a new CAN message is received.
     *
     * @param {object} message - CAN frame.
     * @param {number} message.id - CAN message identifier.
     * @param {Buffer} message.data - CAN message data;
     * @param {number} message.len - CAN message length in bytes.
     * @private
     */
    _onMessage(message) {
        // Handle transfers as a server (local object dictionary)
        const client = this.clients[message.id];
        if(client === undefined)
            return;

        switch(message.data[0] >> 5) {
            case ClientCommand.DOWNLOAD_SEGMENT:
                this._downloadSegment(client, message.data);
                break;
            case ClientCommand.DOWNLOAD_INITIATE:
                this._downloadInitiate(client, message.data);
                break;
            case ClientCommand.UPLOAD_INITIATE:
                this._uploadInitiate(client, message.data);
                break;
            case ClientCommand.UPLOAD_SEGMENT:
                this._uploadSegment(client, message.data);
                break;
            case ClientCommand.ABORT:
                client.reject();
                break;
            default:
                client.abort(SdoCode.BAD_COMMAND);
                break;
        }
    }
}

module.exports=exports={ SdoCode, SdoError, SdoClient, SdoServer };
