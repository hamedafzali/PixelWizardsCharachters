import * as React from 'react';
import type { ActorFrame } from './types.js';
import { ActorRig } from './rig.js';
export interface CharacterActorProps {
    /** character slug from the built-in roster (roozi, ava, …) */
    character: string;
    /** the frame to perform; partial frames merge onto the current one */
    frame?: Partial<ActorFrame>;
    size?: number;
    blink?: boolean;
    className?: string;
    style?: React.CSSProperties;
    /** fires with the resolved frame after each apply */
    onFrame?: (frame: ActorFrame) => void;
    /** receive the underlying rig (for `.speak()`, `.playGesture()`, …) */
    rigRef?: React.MutableRefObject<ActorRig | null>;
}
/**
 * React binding for {@link ActorRig}. The rig owns the DOM and mutates it
 * imperatively; React only feeds it frames, so lip-sync and gaze never trigger
 * a React re-render. Grab `rigRef` to call `speak()` / `playGesture()`.
 */
export declare function CharacterActor({ character, frame, size, blink, className, style, onFrame, rigRef, }: CharacterActorProps): React.ReactElement;
//# sourceMappingURL=react.d.ts.map