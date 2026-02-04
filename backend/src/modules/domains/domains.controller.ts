import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../../utils/types';
import { z } from 'zod';
import { domainsService } from './domains.service';
import { AppError } from '../../utils/errors';
import {
  idSchema,
  domainSchema,
  booleanQuerySchema,
} from '../../utils/validation';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const getDomainsQuerySchema = z.object({
  projectId: idSchema.optional(),
  isActive: booleanQuerySchema,
});

const domainIdParamsSchema = z.object({
  id: idSchema,
});

const createDomainSchema = z.object({
  domain: domainSchema,
  projectId: idSchema,
  sslEnabled: z.boolean().optional().default(true),
});

const updateDomainSchema = z.object({
  sslEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const verifyDomainSchema = z.object({
  domain: domainSchema,
});

// ============================================
// CONTROLLER
// ============================================

class DomainsController {
  /**
   * Get all domains
   * GET /api/domains
   * Filtered by user access: STAFF only see domains from assigned projects
   */
  async getDomains(
    request: FastifyRequest<{
      Querystring: { projectId?: string; isActive?: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate query parameters
    const query = getDomainsQuerySchema.parse(request.query);

    const user = request.user as JwtPayload | undefined;
    const filters: { projectId?: string; isActive?: boolean } = {};

    if (query.projectId) {
      filters.projectId = query.projectId;
    }

    if (query.isActive !== undefined) {
      filters.isActive = query.isActive;
    }

    const domains = await domainsService.getDomains(filters, user?.userId, user?.role);

    return reply.send({
      success: true,
      data: domains,
    });
  }

  /**
   * Get domain by ID
   * GET /api/domains/:id
   */
  async getDomain(
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate params
    const params = domainIdParamsSchema.parse(request.params);

    const domain = await domainsService.getDomainById(params.id);

    if (!domain) {
      throw new AppError(404, 'Domain not found', 'DOMAIN_NOT_FOUND');
    }

    return reply.send({
      success: true,
      data: domain,
    });
  }

  /**
   * Create new domain
   * POST /api/domains
   */
  async createDomain(
    request: FastifyRequest<{
      Body: {
        domain: string;
        projectId: string;
        sslEnabled?: boolean;
      };
    }>,
    reply: FastifyReply
  ) {
    // Validate body
    const body = createDomainSchema.parse(request.body);

    const newDomain = await domainsService.createDomain({
      domain: body.domain,
      projectId: body.projectId,
      sslEnabled: body.sslEnabled,
    });

    return reply.status(201).send({
      success: true,
      data: newDomain,
    });
  }

  /**
   * Update domain
   * PUT /api/domains/:id
   */
  async updateDomain(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        sslEnabled?: boolean;
        isActive?: boolean;
      };
    }>,
    reply: FastifyReply
  ) {
    // Validate params and body
    const params = domainIdParamsSchema.parse(request.params);
    const body = updateDomainSchema.parse(request.body);

    const updatedDomain = await domainsService.updateDomain(params.id, {
      sslEnabled: body.sslEnabled,
      isActive: body.isActive,
    });

    return reply.send({
      success: true,
      data: updatedDomain,
    });
  }

  /**
   * Delete domain
   * DELETE /api/domains/:id
   */
  async deleteDomain(
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply
  ) {
    // Validate params
    const params = domainIdParamsSchema.parse(request.params);

    await domainsService.deleteDomain(params.id);

    return reply.send({
      success: true,
      data: { message: 'Domain deleted successfully' },
    });
  }

  /**
   * Verify domain DNS
   * POST /api/domains/verify
   */
  async verifyDomain(
    request: FastifyRequest<{
      Body: {
        domain: string;
      };
    }>,
    reply: FastifyReply
  ) {
    // Validate body
    const body = verifyDomainSchema.parse(request.body);

    const verification = await domainsService.verifyDomain(body.domain);

    return reply.send({
      success: true,
      data: verification,
    });
  }
}

export const domainsController = new DomainsController();
