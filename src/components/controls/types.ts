export type PadDirection = 'up' | 'down' | 'left' | 'right'

export type ButtonId = 'a' | 'b' | 'select' | 'start'

export type ControlEvent =
  | {
      type: 'dpad'
      direction: PadDirection
      phase: 'down' | 'up' | 'repeat'
    }
  | {
      type: 'button'
      id: ButtonId
      phase: 'down' | 'up'
    }

export type ControlListener = (event: ControlEvent) => void
