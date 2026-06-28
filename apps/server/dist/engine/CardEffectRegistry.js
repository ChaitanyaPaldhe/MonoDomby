"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardEffectRegistry = void 0;
/**
 * Registry for mapping card effects (from CardEffectType) to their execution handlers.
 * Also supports mapping custom string IDs to handlers for CardEffectType.CUSTOM.
 */
class CardEffectRegistry {
    typeHandlers = new Map();
    customHandlers = new Map();
    register(type, handler) {
        this.typeHandlers.set(type, handler);
        return this;
    }
    registerCustom(customHandlerId, handler) {
        this.customHandlers.set(customHandlerId, handler);
        return this;
    }
    get(type) {
        return this.typeHandlers.get(type);
    }
    getCustom(customHandlerId) {
        return this.customHandlers.get(customHandlerId);
    }
}
exports.CardEffectRegistry = CardEffectRegistry;
//# sourceMappingURL=CardEffectRegistry.js.map