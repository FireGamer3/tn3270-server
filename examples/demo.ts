/**
 * Demo application: sign-on screen, a menu and a terminal info screen.
 *
 *   pnpm dev            # then connect a 3270 emulator to localhost:3270
 *   c3270 localhost:3270
 */
import { Server, type Field, type Screen, type Session } from '../src/index.ts';

const PORT = Number(process.env.PORT ?? 3270);

/** Title bar and PF key line that adapt to the terminal's size. */
function frame(session: Session, title: string, keys: string, body: Field[]): Screen {
    const { rows, cols } = session.size;
    const rule = '-'.repeat(cols - 1);
    return {
        fields: [
            {
                row: 1,
                col: 1,
                text: title.padEnd(cols - 21) + new Date().toLocaleTimeString(),
                intense: true,
                color: 'white',
            },
            { row: 2, col: 1, text: rule, color: 'blue' },
            ...body,
            { row: rows - 1, col: 1, text: rule, color: 'blue' },
            { row: rows, col: 1, text: keys, color: 'turquoise' },
        ],
    };
}

async function signOn(session: Session): Promise<string | undefined> {
    let values = { user: '', password: '' };
    let message = '';

    for (;;) {
        const reply = await session.show(
            frame(session, 'TN3270 DEMO - SIGN ON', 'PF3=Exit  ENTER=Sign on', [
                { row: 5, col: 10, text: 'Any user name works; the password is "3270".' },
                { row: 7, col: 10, text: 'User . . . .' },
                {
                    row: 7,
                    col: 24,
                    name: 'user',
                    input: true,
                    length: 8,
                    highlight: 'underscore',
                    color: 'green',
                },
                { row: 8, col: 10, text: 'Password . .' },
                {
                    row: 8,
                    col: 24,
                    name: 'password',
                    input: true,
                    length: 8,
                    hidden: true,
                    highlight: 'underscore',
                },
                { row: 10, col: 10, text: message, color: 'red', intense: true },
            ]),
            { values, alarm: message !== '' },
        );

        if (reply.aid === 'PF3') return undefined;
        values = { user: reply.values.user!.trim(), password: '' };
        if (reply.aid !== 'ENTER') continue;

        if (!values.user) message = 'Enter a user name.';
        else if (reply.values.password!.trim() !== '3270') message = 'Incorrect password.';
        else return values.user.toUpperCase();
    }
}

async function terminalInfo(session: Session) {
    const t = session.terminal;
    const lines = [
        `Terminal type  ${t.terminalType}`,
        `Model          ${t.model ?? 'n/a'}`,
        `Screen size    ${t.alternateSize.rows} x ${t.alternateSize.cols}`,
        `Extended DS    ${t.extended ? 'yes' : 'no'}`,
        `Color          ${t.color ? 'yes' : 'no'}`,
        `Highlighting   ${t.highlighting ? 'yes' : 'no'}`,
        `Queried        ${t.queried ? 'yes' : 'no'}`,
    ];
    const colors = ['blue', 'red', 'pink', 'green', 'turquoise', 'yellow', 'white'] as const;
    await session.show(
        frame(session, 'TERMINAL INFORMATION', 'Any key=Back', [
            ...lines.map((text, i) => ({ row: 4 + i, col: 5, text })),
            ...colors.map((color, i) => ({
                row: 13,
                col: 5 + i * 11,
                text: color.toUpperCase(),
                color,
            })),
            { row: 15, col: 5, text: 'REVERSE', highlight: 'reverse' as const },
            { row: 15, col: 16, text: 'UNDERSCORE', highlight: 'underscore' as const },
            { row: 15, col: 30, text: 'BLINK', highlight: 'blink' as const },
            {
                row: session.size.rows - 2,
                col: 5,
                text: `Bottom row ${session.size.rows - 2} of ${session.size.rows}`,
            },
        ]),
    );
}

async function menu(session: Session, user: string) {
    let message = '';
    for (;;) {
        const reply = await session.show(
            frame(session, `TN3270 DEMO - MAIN MENU          User: ${user}`, 'PF3=Sign off', [
                { row: 5, col: 10, text: '1  Terminal information' },
                { row: 6, col: 10, text: '2  Echo text' },
                { row: 8, col: 10, text: 'Option ===>' },
                {
                    row: 8,
                    col: 22,
                    name: 'option',
                    input: true,
                    length: 2,
                    numeric: true,
                    highlight: 'underscore',
                },
                { row: 10, col: 10, text: message, color: 'red' },
            ]),
        );
        message = '';

        if (reply.aid === 'PF3') return;
        if (reply.aid !== 'ENTER') continue;

        switch (reply.values.option!.trim()) {
            case '1':
                await terminalInfo(session);
                break;
            case '2':
                await echo(session);
                break;
            default:
                message = `Unknown option "${reply.values.option!.trim()}".`;
        }
    }
}

async function echo(session: Session) {
    let text = '';
    for (;;) {
        const reply = await session.show(
            frame(session, 'ECHO', 'PF3=Back  ENTER=Echo', [
                { row: 4, col: 5, text: 'Type something:' },
                { row: 4, col: 21, name: 'text', input: true, length: 40, highlight: 'underscore' },
                { row: 6, col: 5, text: text ? `You typed: ${text}` : '', color: 'yellow' },
            ]),
        );
        if (reply.aid === 'PF3') return;
        text = reply.values.text!.trim();
    }
}

const server = new Server(
    async (session) => {
        const user = await signOn(session);
        if (user) await menu(session, user);
        session.write(frame(session, 'GOODBYE', '', [{ row: 5, col: 10, text: 'Session ended.' }]));
        await new Promise((resolve) => setTimeout(resolve, 1500));
    },
    { logger: console },
);

await server.listen(PORT);
