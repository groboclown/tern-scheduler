"use strict";
exports.__esModule = true;
var convert_1 = require("./convert");
function currentTimeUTC() {
    var now = exports.CurrentTime.get();
    return convert_1.toUTC(now);
}
exports.currentTimeUTC = currentTimeUTC;
exports.CurrentTime = {
    get: function () {
        return new Date();
    }
};
