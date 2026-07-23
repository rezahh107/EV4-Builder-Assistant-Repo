export function checkpointSequenceIsValid(checkpoint) {
  if (!Number.isInteger(checkpoint?.checkpoint_sequence) || checkpoint.checkpoint_sequence < 1) return false;
  if (checkpoint.checkpoint_sequence === 1) return checkpoint.parent_checkpoint_id === null;
  return typeof checkpoint.parent_checkpoint_id === 'string' && checkpoint.parent_checkpoint_id.trim().length > 0;
}

export function validateCheckpointSequence(checkpoint, code = 'BUILDER-CHECKPOINT-SEQUENCE-001', label = 'Checkpoint') {
  return checkpointSequenceIsValid(checkpoint)
    ? []
    : [{
        code,
        message: `${label} sequence/parent relationship is invalid. sequence 1 requires parent_checkpoint_id=null; later sequences require a non-empty parent_checkpoint_id.`
      }];
}
