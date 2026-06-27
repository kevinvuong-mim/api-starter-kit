# Replay Key Retention

`game_replay_keys` stores replay-hash deduplication keys outside `game_results` partitions so idempotent retries still work after result partitions rotate.

This table is now pruned by `GameReplayKeyRetentionService` on the first day of each month at `04:30`.

## Environment

| Variable | Default | Purpose |
|---|---:|---|
| `REPLAY_KEY_RETENTION_MONTHS` | `36` | How long replay keys remain eligible for duplicate detection. |
| `REPLAY_KEY_RETENTION_BATCH_SIZE` | `5000` | Number of keys deleted per batch. |

## Compatibility

After a replay key is pruned, the backend can no longer detect that replay hash as a duplicate. Keep this value at least as long as `GAME_RESULTS_RETENTION_MONTHS` unless storage pressure requires a shorter dedup window.

## Rollback

Set `REPLAY_KEY_RETENTION_MONTHS` to a very large value or disable the cron provider if strict long-lived deduplication is required.
