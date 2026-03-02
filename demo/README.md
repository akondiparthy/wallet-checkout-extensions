# WCE Checkout Simulator

This simulator demonstrates the WCE extension model in a wallet-controlled checkout shell.

## Run

Open `index.html` directly in a browser.

## What to Test

1. Baseline flow
   - Click **Start Checkout**
   - Wait for `USER_CONFIRM`
   - Click **Confirm Purchase**

2. Timeout fallback
   - Set **Simulated Extension Delay** to `220`
   - Start checkout
   - Observe extension timeout logs and fallback rendering

3. Region policy
   - Switch **Policy Region** to `EU`
   - Start checkout
   - Observe identity/eligibility extension denied (`region_blocked`)

4. Kill switches
   - Enable one or more kill switches
   - Start checkout
   - Observe policy denials with deterministic continuation

5. Auth failure
   - Enable **Force authorization failure**
   - Confirm purchase and observe `SUCCESS/FAILURE` handling
