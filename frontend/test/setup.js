import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"


// jsdom has no modal dialogs: opening one only sets `open`, and Escape is left to the tests
// (`fireEvent(dialog, new Event("cancel", { cancelable: true }))`)
HTMLDialogElement.prototype.showModal ??= function () {
  if (!this.isConnected)
    throw new DOMException("The dialog isn't in the document", "InvalidStateError")
  this.setAttribute("open", "")
}
HTMLDialogElement.prototype.close ??= function () {
  this.removeAttribute("open")
}


afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
