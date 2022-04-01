const UP = 1;
const DOWN = 2;
const LEFT = 3;
const RIGHT = 4;
//we lock the scroll direction to either horizontal or vertical after the first motion
let dirLock = null;

const OFF = 1;
const PRIMED = 2;
const ACTIVE = 3;
let state = OFF;

let startTime = 0;

//either -1 or 1 depending on scrollbar behavior or drag behavior
let multiply = 1;

let mTarget = null;  //e.target

let mScreenX = 0;  //e.screenX
let mScreenY = 0;  //e.screenY

let mPageX = 0;  //n.scrollLeft
let mPageY = 0;  //n.scrollTop
let mScrollWidth = 0;  //n.scrollWidth
let mScrollHeight = 0;  //n.scrollHeight

//a generated fullscreen DIV to capture events over iframes
let transLayer = null;

window.addEventListener("mousedown", e => {
  if (state !== OFF) {
    clearAllEvents();
    e.preventDefault();

  } else if (e.button === 1 && !e.defaultPrevented) {
    //we need the [primed] state because we need the determine 
    //the scroll direction before we can find the most appropriate 
    //scrollable element
    state = PRIMED;

    mTarget = e.target;
    mScreenX = e.screenX;
    mScreenY = e.screenY;

    window.addEventListener("mousemove", onMouseMove, {
      passive: true,
      capture: false,
    });
    window.addEventListener("mouseup", onMouseUp, {
      passive: false,
      capture: true,
      once: true,
    });
    window.addEventListener("keydown", onKeyDown, {
      passive: true,
      capture: false,
    });
  }
}, false);

function clearAllEvents() {
  state = OFF;
  window.removeEventListener("mousemove", onMouseMove, {
    passive: true,
    capture: false,
  });
  window.removeEventListener("mouseup", onMouseUp, {
    passive: false,
    capture: true,
    once: true,
  });
  window.removeEventListener("keydown", onKeyDown, {
    passive: true,
    capture: false,
  });
  setTransparentLayer(false);
}

function findScrollable(n, dir) {
  //we find the first element that is scrollable and is not already
  //scrolled to the maximum extent in the pre-determined direction.
  //If we cannot find one, we return the document element.
  if (dir === UP || dir === DOWN) {
    do {
      let visible = n.clientHeight;
      let scrollable = n.scrollHeight;
      if (scrollable > 0 && visible > 0 && visible < scrollable - 5) {
        const overflowY = getComputedStyle(n).overflowY;
        if (overflowY && overflowY !== "visible" && overflowY !== "hidden") {
          if (n === document.body) {
            break;
          } else if (dir === UP && n.scrollTop > 0) {
            return n;
          } else if (dir === DOWN && n.scrollTop + visible < scrollable) {
            return n;
          }
        }
      }
    } while ((n = n.parentElement) && n);
  } else {
    do {
      let visible = n.clientWidth;
      let scrollable = n.scrollWidth;
      if (scrollable > 0 && visible > 0 && visible < scrollable - 5) {
        const overflowX = getComputedStyle(n).overflowX;
        if (overflowX && overflowX !== "visible" && overflowX !== "hidden") {
          if (n === document.body) {
            break;
          } else if (dir === LEFT && n.scrollLeft > 0) {
            return n;
          } else if (dir === RIGHT && n.scrollLeft + visible < scrollable) {
            return n;
          }
        }
      }
    } while ((n = n.parentElement) && n);
  }
  return null;
}

function setTransparentLayer(show) {
  if (show) {
    if (!transLayer) {
      transLayer = document.createElement("div");
      transLayer.style.cssText =
        "position:fixed; margin:0; top:0; right:0; bottom:0; left:0; " +
        "z-index: 1000; background:white; opacity: 0.01; cursor: grabbing";
      document.body.appendChild(transLayer);
    }
  } else if (transLayer) {
    transLayer.parentNode.removeChild(transLayer);
    transLayer = null;
  }
}

function setCursor(type, dir) {
  if (transLayer) {
    if (dir === "none") {
      transLayer.style.cursor = "not-allowed";

    } else if (type === "doc") {
      transLayer.style.cursor = 
        dir === UP || dir === DOWN ? "ns-resize" : "ew-resize";
    } else {
      transLayer.style.cursor = 
        dir === UP || dir === DOWN ? "row-resize" : "col-resize";
    }
  }
}

function onMouseUp(e) {
  if (state === ACTIVE) e.preventDefault();
  //we support an optimization where if the user releases the mouse button
  //really quickly, we allow them to continue scrolling without needing
  //to keep the mouse button depressed
  if (state === PRIMED || Date.now() - startTime > 250) clearAllEvents();
}

function onMouseMove(e) {
  if (state === OFF) {
    clearAllEvents();
    return;
  }

  if (state === PRIMED) {
    let absX = Math.abs(e.screenX - mScreenX);
    let absY = Math.abs(e.screenY - mScreenY);

    //require the user to move 4 pixels so we are certain of the direction
    if (absX < 4 && absY < 4) return;

    startTime = Date.now();
    state = ACTIVE;

    dirLock = absY < absX ?
    (e.screenX > mScreenX ? RIGHT : LEFT) :
    (e.screenY > mScreenY ? DOWN : UP);

    if (multiply === -1) {
      //reverse scroll direction
      dirLock = dirLock === UP ? DOWN : dirLock === DOWN ? UP : dirLock === LEFT ? RIGHT : LEFT;
    }

    mTarget = findScrollable(mTarget, dirLock);

    setTransparentLayer(true);

    if (mTarget) {
      setCursor("inner", dirLock);

    } else {
      mTarget = document.scrollingElement;

      if (dirLock === UP || dirLock === DOWN) {
        const noScroll = (mTarget.scrollTop === 0 && mTarget.clientHeight > mTarget.scrollHeight - 5);
        setCursor("doc", noScroll ? "none" : dirLock);
      } else {
        const noScroll = (mTarget.scrollLeft === 0 && mTarget.clientWidth > mTarget.scrollWidth - 5);
        setCursor("doc", noScroll ? "none" : dirLock);
      }
    }

    mScreenX = e.screenX;
    mScreenY = e.screenY;
    mPageX = mTarget.scrollLeft;
    mPageY = mTarget.scrollTop;
    mScrollWidth = mTarget.scrollWidth;
    mScrollHeight = mTarget.scrollHeight;

    mTarget.style.scrollBehavior = "auto";
  }

  if (dirLock === UP || dirLock === DOWN) {
    const ratioY = (e.screenY - mScreenY) / window.innerHeight * 0.9;
    const top = mPageY + multiply * (mScrollHeight * ratioY);

    const height = mTarget.clientHeight;
    if (top < 0 || top + height > mScrollHeight) {
      //if the scroll gesture exceeds the max value, treat the 
      //new gesture position as the new base value so we can
      //scroll in the opposite direction immediately on reverse
      mScreenY = e.screenY;
      mPageY = mTarget.scrollTop;
      //cancel the escape key function because we have re-based
      //the position and lost the original value
      window.removeEventListener("keydown", onKeyDown, false);
    }
    mTarget.scrollTop = top;

  } else {
    const ratioX = (e.screenX - mScreenX) / window.innerWidth * 0.9;
    const left = mPageX + multiply * (mScrollWidth * ratioX);

    const width = mTarget.clientWidth;
    if (left < 0 || left + width > mScrollWidth) {
      mScreenX = e.screenX;
      mPageX = mTarget.scrollLeft;
      window.removeEventListener("keydown", onKeyDown, false);
    }
    mTarget.scrollLeft = left;
  }
}

function onKeyDown(e) {
  if (e.key === "Escape") {
    //restore the original scroll position on Escape
    mTarget.scrollLeft = mPageX;
    mTarget.scrollTop = mPageY;
    e.preventDefault();
    clearAllEvents();
  }
}

chrome.storage.local.get({ likeTouch: false }, ({ likeTouch }) => {
  multiply = likeTouch ? -1 : 1;
});

chrome.storage.onChanged.addListener(({ likeTouch }) => {
  multiply = likeTouch.newValue ? -1 : 1;
});
