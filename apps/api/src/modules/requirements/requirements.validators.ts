// apps/api/src/modules/requirements/requirements.validators.ts
import { z } from 'zod'

export const updateResponseSchema = z.object({
  implementationText: z.string().optional(),
  implementationDate: z.string().optional(),
  responsiblePerson: z.string().max(255).optional(),
  notes: z.string().optional(),
  subReqResponses: z.record(z.object({
    done: z.boolean(),
    note: z.string().optional(),
  })).optional(),
})

export const assessSchema = z.object({
  score: z.enum(['non_conforming', 'partially_conforming', 'conforming', 'fully_conforming', 'not_applicable']),
  assessmentText: z.string().min(20, 'O parecer técnico deve ter pelo menos 20 caracteres.'),
  recommendations: z.string().optional(),
  internalNotes: z.string().optional(),
})
