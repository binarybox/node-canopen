const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const {EDS, Device} = require('../../index');

const expect = chai.expect;
chai.use(chaiAsPromised);

describe('EMCY', function() {
    let node = null;

    beforeEach(function() {
        /* Pre-defined error field. */
        node = new Device({ id: 0xA, loopback: true });
        node.EDS.addEntry(0x1003, {
            ParameterName:      'Pre-defined error field',
            ObjectType:         EDS.objectTypes.ARRAY,
            SubNumber:          1,
        });
        node.EDS.addSubEntry(0x1003, 1, {
            ParameterName:      'Standard error field',
            ObjectType:         EDS.objectTypes.VAR,
            DataType:           EDS.dataTypes.UNSIGNED32,
            AccessType:         EDS.accessTypes.READ_WRITE,
        });

        /* COB-ID EMCY. */
        node.EDS.addEntry(0x1014, {
            ParameterName:      'COB-ID EMCY',
            ObjectType:         EDS.objectTypes.VAR,
            DataType:           EDS.dataTypes.UNSIGNED32,
            AccessType:         EDS.accessTypes.READ_WRITE,
            DefaultValue:       0x80,
        });
    });

    afterEach(function() {
        delete node;
    });

    it('should require 0x1001', function() {
        node.EDS.removeEntry(0x1001);
        return expect(() => { node.init(); }).to.throw(ReferenceError);
    });

    it('should require 0x1014', function() {
        node.EDS.removeEntry(0x1014);
        return expect(() => { node.EMCY.write(0x1000); }).to.throw(ReferenceError);
    });

    it('should produce an emergency object', function(done) {
        node.init();
        node.channel.addListener('onMessage', () => { done(); });
        node.EMCY.write(0x1000);
    });

    it('should emit on consuming an emergency object', function(done) {
        node.init();
        node.on('emergency', () => { done(); });
        node.EMCY.write(0x1000);
    });

    it('should track error history', function() {
        node.init();
        return node.EMCY.write(0x1234).then(() => {
            return expect(node.EDS.getSubEntry(0x1003, 1).value).to.equal(0x1234);
        });
    });
});
