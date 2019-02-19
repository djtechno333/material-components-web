/**
 * @license
 * Copyright 2016 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import {getCorrectEventName} from '@material/animation/util';
import {MDCComponent} from '@material/base/component';
import {ponyfill} from '@material/dom/index';
import {MDCRipple, MDCRippleAdapter, MDCRippleFoundation, RippleCapableSurface} from '@material/ripple/index';
import {MDCCheckboxAdapter} from './adapter';
import {MDCCheckboxFoundation} from './foundation';

const {NATIVE_CONTROL_SELECTOR} = MDCCheckboxFoundation.strings;

const CB_PROTO_PROPS = ['checked', 'indeterminate'];

export class MDCCheckbox extends MDCComponent<MDCCheckboxFoundation> implements RippleCapableSurface {

  static attachTo(root: Element) {
    return new MDCCheckbox(root);
  }

  /**
   * Returns the state of the native control element, or null if the native control element is not present.
   */
  get nativeCb_(): HTMLInputElement {
    const cbEl = this.root_.querySelector<HTMLInputElement>(NATIVE_CONTROL_SELECTOR);
    if (!cbEl) {
      throw new Error(`Checkbox requires a ${NATIVE_CONTROL_SELECTOR} element`);
    }
    return cbEl;
  }

  // Public visibility for this property is required by RippleCapableSurface.
  root_!: Element; // assigned in MDCComponent constructor

  private readonly ripple_: MDCRipple = this.createRipple_();
  private handleChange_!: EventListener; // assigned in initialSyncWithDOM()
  private handleAnimationEnd_!: EventListener; // assigned in initialSyncWithDOM()

  initialSyncWithDOM() {
    this.handleChange_ = () => this.foundation_.handleChange();
    this.handleAnimationEnd_ = () => this.foundation_.handleAnimationEnd();
    this.nativeCb_.addEventListener('change', this.handleChange_);
    this.listen(getCorrectEventName(window, 'animationend'), this.handleAnimationEnd_);
    this.installPropertyChangeHooks_();
  }

  destroy() {
    this.ripple_.destroy();
    this.nativeCb_.removeEventListener('change', this.handleChange_);
    this.unlisten(getCorrectEventName(window, 'animationend'), this.handleAnimationEnd_);
    this.uninstallPropertyChangeHooks_();
    super.destroy();
  }

  getDefaultFoundation() {
    // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
    // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
    const adapter: MDCCheckboxAdapter = {
      addClass: (className) => this.root_.classList.add(className),
      forceLayout: () => (this.root_ as HTMLElement).offsetWidth,
      hasNativeControl: () => !!this.nativeCb_,
      isAttachedToDOM: () => Boolean(this.root_.parentNode),
      isChecked: () => this.checked,
      isIndeterminate: () => this.indeterminate,
      removeClass: (className) => this.root_.classList.remove(className),
      removeNativeControlAttr: (attr) => this.nativeCb_.removeAttribute(attr),
      setNativeControlAttr: (attr, value) => this.nativeCb_.setAttribute(attr, value),
      setNativeControlDisabled: (disabled) => this.nativeCb_.disabled = disabled,
    };
    return new MDCCheckboxFoundation(adapter);
  }

  private createRipple_(): MDCRipple {
    // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
    // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
    const adapter: MDCRippleAdapter = {
      ...MDCRipple.createAdapter(this),
      deregisterInteractionHandler: (evtType, handler) => this.nativeCb_.removeEventListener(evtType, handler),
      isSurfaceActive: () => ponyfill.matches(this.nativeCb_, ':active'),
      isUnbounded: () => true,
      registerInteractionHandler: (evtType, handler) => this.nativeCb_.addEventListener(evtType, handler),
    };
    return new MDCRipple(this.root_, new MDCRippleFoundation(adapter));
  }

  private installPropertyChangeHooks_() {
    const nativeCb = this.nativeCb_;
    const cbProto = Object.getPrototypeOf(nativeCb);

    CB_PROTO_PROPS.forEach((controlState) => {
      const desc = Object.getOwnPropertyDescriptor(cbProto, controlState);
      // We have to check for this descriptor, since some browsers (Safari) don't support its return.
      // See: https://bugs.webkit.org/show_bug.cgi?id=49739
      if (!validDescriptor(desc)) {
        return;
      }

      const nativeCbDesc = {
        configurable: desc.configurable,
        enumerable: desc.enumerable,
        get: desc.get,
        set: (state: boolean) => {
          desc.set!.call(nativeCb, state);
          this.foundation_.handleChange();
        },
      };
      Object.defineProperty(nativeCb, controlState, nativeCbDesc);
    });
  }

  private uninstallPropertyChangeHooks_() {
    const nativeCb = this.nativeCb_;
    const cbProto = Object.getPrototypeOf(nativeCb);

    CB_PROTO_PROPS.forEach((controlState) => {
      const desc = Object.getOwnPropertyDescriptor(cbProto, controlState);
      if (!validDescriptor(desc)) {
        return;
      }
      Object.defineProperty(nativeCb, controlState, desc);
    });
  }

  get ripple(): MDCRipple {
    return this.ripple_;
  }

  get checked(): boolean {
    return this.nativeCb_.checked;
  }

  set checked(checked: boolean) {
    this.nativeCb_.checked = checked;
  }

  get indeterminate(): boolean {
    return this.nativeCb_.indeterminate;
  }

  set indeterminate(indeterminate: boolean) {
    this.nativeCb_.indeterminate = indeterminate;
  }

  get disabled(): boolean {
    return this.nativeCb_.disabled;
  }

  set disabled(disabled: boolean) {
    this.foundation_.setDisabled(disabled);
  }

  get value(): string {
    return this.nativeCb_.value;
  }

  set value(value: string) {
    this.nativeCb_.value = value;
  }
}

function validDescriptor(inputPropDesc: PropertyDescriptor | undefined): inputPropDesc is PropertyDescriptor {
  return !!inputPropDesc && typeof inputPropDesc.set === 'function';
}
