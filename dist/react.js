import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { ActorRig } from './rig.js';
import { CHARACTERS } from './characters/index.js';
/**
 * React binding for {@link ActorRig}. The rig owns the DOM and mutates it
 * imperatively; React only feeds it frames, so lip-sync and gaze never trigger
 * a React re-render. Grab `rigRef` to call `speak()` / `playGesture()`.
 */
export function CharacterActor({ character, frame, size = 160, blink = true, className, style, onFrame, rigRef, }) {
    const hostRef = React.useRef(null);
    const rig = React.useRef(null);
    // Mount / re-mount when the character changes.
    React.useEffect(() => {
        const spec = CHARACTERS[character];
        if (!hostRef.current || !spec)
            return;
        const r = new ActorRig(spec, { size, blink, onFrame });
        r.mount(hostRef.current);
        rig.current = r;
        if (rigRef)
            rigRef.current = r;
        if (frame)
            r.apply(frame);
        return () => {
            r.destroy();
            if (rigRef && rigRef.current === r)
                rigRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [character, size, blink]);
    // Feed frames on update.
    React.useEffect(() => {
        if (rig.current && frame)
            rig.current.apply(frame);
    }, [frame]);
    return _jsx("div", { ref: hostRef, className: className, style: style });
}
//# sourceMappingURL=react.js.map