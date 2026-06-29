"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeValidator = void 0;
const shared_1 = require("@monopoly/shared");
const errors_js_1 = require("./errors.js");
const PhaseUtils_js_1 = require("./utils/PhaseUtils.js");
class TradeValidator {
    /**
     * Validates if any trade action is allowed at the current moment.
     * Checks phase requirements (no auction, no debt recovery, no cards pending).
     */
    static validateCanTrade(state) {
        if (!(0, PhaseUtils_js_1.canTrade)(state)) {
            throw new errors_js_1.EngineValidationError('Trading is not permitted in the current phase', shared_1.ErrorCode.E_INVALID_PHASE);
        }
    }
}
exports.TradeValidator = TradeValidator;
//# sourceMappingURL=TradeValidator.js.map