import { z } from 'zod';

// ============================================================================
// SESSION STATUS ENUM
// ============================================================================

export const SessionStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'SOLD_OUT', 'CANCELLED', 'COMPLETED']);
export type SessionStatus = z.infer<typeof SessionStatusEnum>;

// ============================================================================
// CREATE SESSION
// ============================================================================

export const CreateSessionSchema = z.object({
  venueId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: 'End time must be after start time', path: ['endTime'] }
);

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

// ============================================================================
// UPDATE SESSION
// ============================================================================

export const UpdateSessionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;

// ============================================================================
// TARIFF SCHEMAS
// ============================================================================

export const CreateTariffSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().min(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type CreateTariffInput = z.infer<typeof CreateTariffSchema>;

export const UpdateTariffSchema = CreateTariffSchema.partial();
export type UpdateTariffInput = z.infer<typeof UpdateTariffSchema>;

export const CreateMultipleTariffsSchema = z.object({
  tariffs: z.array(CreateTariffSchema).min(1).max(20),
});

export type CreateMultipleTariffsInput = z.infer<typeof CreateMultipleTariffsSchema>;

// ============================================================================
// TARIFF SEAT ASSIGNMENT
// ============================================================================

export const AssignSeatsToTariffSchema = z.object({
  seatIds: z.array(z.string().uuid()).min(1),
});

export type AssignSeatsToTariffInput = z.infer<typeof AssignSeatsToTariffSchema>;

export const BulkAssignTariffSchema = z.object({
  assignments: z.array(z.object({
    tariffId: z.string().uuid(),
    seatIds: z.array(z.string().uuid()).min(1),
  })).min(1),
});

export type BulkAssignTariffInput = z.infer<typeof BulkAssignTariffSchema>;

export const AutoAssignTariffSchema = z.object({
  strategy: z.enum(['equal_sections', 'by_row', 'by_distance_from_stage']),
  tariffIds: z.array(z.string().uuid()).min(2),
});

export type AutoAssignTariffInput = z.infer<typeof AutoAssignTariffSchema>;

// ============================================================================
// PRICING RULES
// ============================================================================

export const PricingRuleTypeEnum = z.enum(['EARLY_BIRD', 'LAST_MINUTE', 'PROMO_CODE', 'GROUP_DISCOUNT']);
export type PricingRuleType = z.infer<typeof PricingRuleTypeEnum>;

export const CreatePricingRuleSchema = z.object({
  type: PricingRuleTypeEnum,
  name: z.string().min(1).max(100),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.number().min(0),
  code: z.string().optional(), // For promo codes
  minQuantity: z.number().int().min(1).optional(), // For group discounts
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  maxUses: z.number().int().min(1).optional(),
  isActive: z.boolean().default(true),
});

export type CreatePricingRuleInput = z.infer<typeof CreatePricingRuleSchema>;

// ============================================================================
// DUPLICATE SESSION
// ============================================================================

export const DuplicateSessionSchema = z.object({
  name: z.string().min(1).max(200),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  copyTariffs: z.boolean().default(true),
  copyPricingRules: z.boolean().default(false),
});

export type DuplicateSessionInput = z.infer<typeof DuplicateSessionSchema>;

// ============================================================================
// QUERY PARAMS
// ============================================================================

export const SessionQuerySchema = z.object({
  venueId: z.string().uuid().optional(),
  status: SessionStatusEnum.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SessionQueryInput = z.infer<typeof SessionQuerySchema>;

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface SessionResponse {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  venue?: {
    id: string;
    name: string;
    capacity: number;
  };
  _count?: {
    seats: number;
    tariffs: number;
    bookings: number;
  };
}

export interface TariffResponse {
  id: string;
  sessionId: string;
  name: string;
  price: number;
  color: string;
  description: string | null;
  isActive: boolean;
  _count?: {
    TariffSeat: number;
  };
}

export interface SeatWithTariffResponse {
  id: string;
  row: string;
  number: string;
  section: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: string;
  rotation: number;
  status: string;
  tariff?: {
    id: string;
    name: string;
    price: number;
    color: string;
  } | null;
}

export interface SessionDetailResponse extends SessionResponse {
  venue: {
    id: string;
    name: string;
    address: string;
    capacity: number;
    schema: unknown;
  };
  tariffs: TariffResponse[];
  seats: SeatWithTariffResponse[];
  stats: {
    totalSeats: number;
    availableSeats: number;
    reservedSeats: number;
    occupiedSeats: number;
    seatsWithTariff: number;
    seatsWithoutTariff: number;
    revenue: {
      potential: number;
      confirmed: number;
    };
  };
}

// ============================================================================
// VALIDATION RESULT
// ============================================================================

export interface SessionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
