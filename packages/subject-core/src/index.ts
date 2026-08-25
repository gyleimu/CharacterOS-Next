/**
 * P2.1.1 — Subject Core schema types public surface.
 * Types + constants only. No commit engine, validation, hash, store, runtime or domain logic.
 */

export type {
  Brand,
  IdentifierV0,
  TransitionIdV0,
  LogicalTimeV0,
  StateRevisionV0,
  HistorySequenceV0,
  UnitIntervalV0,
  HashV1,
  RepositoryRevisionIdV0,
  RequirementIdV1,
  ResultRefV0
} from "./types/scalars.js";

export {
  REF_KINDS,
  AFFECT_CHANNEL_IDS,
  TRANSITION_TYPES
} from "./types/enums.js";

export type {
  RefKind,
  AffectChannelId,
  AffectPhase,
  TransitionType,
  TimeInputKind,
  StatusValue,
  ErrorCode,
  P21RequirementId,
  LaterPhaseRequirementId,
  RequirementId,
  ProducerName,
  DomainName
} from "./types/enums.js";

export type { CanonicalRefV0, RefIdV0 } from "./types/ref.js";

export type {
  SubjectStateV0,
  IdentityV0,
  OriginMetadataV0,
  TraitsSeedV0,
  RetrievalConfigV0,
  MemoryStateV0,
  BeliefsV0,
  BeliefItemV0,
  RelationshipsV0,
  RelationshipModelV0,
  MoodV0,
  AffectV0,
  AffectChannelV0,
  RegulatoryStateV0,
  WorkingContextV0,
  MechanismConfigV0,
  AffectProfileV0,
  LegacyReferenceDefaultsV0,
  RuntimeMetadataV0,
  EmptyClosedObjectV0
} from "./types/subject-state.js";

export type {
  TraceCursorV1,
  TraceEntryV1,
  TraceWindowV1,
  DomainMutationSummaryV1,
  TraceLayerName,
  FieldChangeSummaryV1
} from "./types/trace.js";

export type {
  CanonicalTransitionProposalV1,
  DomainDeltaV0,
  FieldReplacementV0,
  TimeInputV1,
  ElapsedDurationV1,
  WritableFieldPathV0,
  ReadonlyFieldPathV0,
  CanonicalFieldPathV0
} from "./types/transition.js";

export type {
  CanonicalCommitResultV1,
  AlreadyCommittedResultV1,
  NoOpTransitionResultV1,
  LearningRebaseRequiredResultV1,
  CanonicalErrorResultV1,
  AdmissionErrorResultV1,
  MICLAdmissionErrorResultV1,
  LogicalTransitionResultV1,
  LogicalTransitionStatus,
  PublishObservationV1,
  PreparedLogicalResultV1,
  PreparedLogicalResultBindingV1,
  WorkflowBindingV0,
  MiclStageKey,
  AdmissionOperation
} from "./types/result.js";

export type {
  AuthoritativeTransitionRecordV1,
  TransitionAttemptV1,
  TransitionReuseConflictV1,
  AuditEventV1,
  ReservedTransitionContinuationV1,
  ReservationRoute
} from "./types/identity.js";

export type {
  RepositoryRevisionManifestV1,
  RepositoryRecordHashV1,
  RepositoryRevisionBindingV1,
  PersistedSubjectEnvelopeV1,
  CommitHeadV1,
  MutationHistoryLinkV1,
  AtomicCommitBundleV1,
  CommitFailureCertainty,
  AtomicCommitOutcomeV1,
  StateReaderPort,
  AtomicCommitStorePort,
  PublishSinkPort,
  ReferenceValidatorPort
} from "./types/persistence.js";
