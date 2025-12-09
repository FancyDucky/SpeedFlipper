# Speedflip Trainer (Rocket League)

Web-based tool that reads your controller input (via the Gamepad API) while you run Rocket League, and scores how close your inputs are to a proper **speedflip**.

## Usage

1. Install dependencies (optional, only needed if you want a local dev server):

```bash
npm install
```

2. Start a static dev server:

```bash
npm start
```

3. Open the URL printed by the server (usually `http://localhost:3000` or `http://localhost:5000`) in your browser.

4. In Rocket League:
   - Load **Musty's Speedflip Kickoff Test** training pack: `A503-264C-A7EB-D282`.
   - Use default Xbox-style controller bindings (A = Jump, B = Boost, RT = Throttle, LT = Reverse, X = Neutral Air Roll, LB/RB = Directional Air Roll).

5. In the browser:
   - Focus the tab and press any button on your controller once so the browser can see it.
   - Each time you hit **Reset Shot** in-game, click **Start Attempt** on the site at the same time.

The current attempt panel will show:

- Car settle time (time from reset/start until first input)
- Whether you boosted before throttling
- Time from first input to first jump, scored as Slow / Bit Slow / Perfect / Bit Fast / Fast
- Left stick angle at the second jump (for a left speedflip)
- Time between jump presses
- Flip cancel timing (time from second jump to pulling the stick downward)

Recent attempts are summarized in the table at the bottom so you can see consistency over time.



