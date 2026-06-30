import { Injectable } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import {
  ProfileSearchRepository,
  ProfileSearchResult,
} from '../../domain/ports/repositories.port';

const VERSION_AWARE_UPSERT_SCRIPT = `
  if (ctx.op == 'create') {
    ctx._source = params.doc;
  } else if (ctx._source.version == null || params.doc.version > ctx._source.version) {
    ctx._source.putAll(params.doc);
  }
`;

@Injectable()
export class OpenSearchProfileRepository implements ProfileSearchRepository {
  private readonly index: string;

  constructor(private readonly client: Client, indexName?: string) {
    this.index = indexName ?? process.env.OPENSEARCH_INDEX ?? 'profiles-v1';
  }

  async search(params: {
    query?: string;
    status?: string;
    limit: number;
    offset: number;
  }): Promise<ProfileSearchResult> {
    const must: Record<string, unknown>[] = [];

    if (params.query) {
      must.push({
        multi_match: {
          query: params.query,
          fields: ['displayName', 'displayName._2gram', 'displayName._3gram', 'username'],
          type: 'best_fields',
        },
      });
    }

    if (params.status) {
      must.push({ term: { status: params.status } });
    }

    const body = {
      from: params.offset,
      size: params.limit,
      query: must.length > 0 ? { bool: { must } } : { match_all: {} },
    };

    const response = await this.client.search({ index: this.index, body });
    const hits = response.body.hits.hits as Array<{
      _source: Record<string, unknown>;
    }>;
    const total =
      typeof response.body.hits.total === 'number'
        ? response.body.hits.total
        : (response.body.hits.total?.value ?? 0);

    return {
      items: hits.map((h) => this.toHit(h._source)),
      total,
    };
  }

  async upsertVersionAware(
    id: string,
    version: number,
    document: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      await this.client.update({
        index: this.index,
        id,
        body: {
          scripted_upsert: true,
          upsert: { ...document, version },
          script: {
            source: VERSION_AWARE_UPSERT_SCRIPT,
            lang: 'painless',
            params: { doc: { ...document, version } },
          },
        },
        refresh: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.client.delete({ index: this.index, id, refresh: true });
    } catch {
      // idempotent delete
    }
  }

  private toHit(source: Record<string, unknown>) {
    return {
      id: String(source.id),
      username: String(source.username),
      email: String(source.email),
      displayName: String(source.displayName),
      avatarUrl: (source.avatarUrl as string | null) ?? null,
      status: String(source.status),
      version: Number(source.version),
      createdAt: String(source.createdAt),
      updatedAt: String(source.updatedAt),
    };
  }
}

export class InMemoryOpenSearchIndex {
  private documents = new Map<string, Record<string, unknown>>();

  get(id: string): Record<string, unknown> | undefined {
    return this.documents.get(id);
  }

  upsertVersionAware(
    id: string,
    version: number,
    document: Record<string, unknown>,
  ): boolean {
    const existing = this.documents.get(id);
    if (!existing || Number(existing.version) < version) {
      this.documents.set(id, { ...document, version });
      return true;
    }
    return false;
  }

  delete(id: string): void {
    this.documents.delete(id);
  }

  search(params: {
    query?: string;
    status?: string;
    limit: number;
    offset: number;
  }): ProfileSearchResult {
    let items = Array.from(this.documents.values());

    if (params.status) {
      items = items.filter((d) => d.status === params.status);
    }
    if (params.query) {
      const q = params.query.toLowerCase();
      items = items.filter(
        (d) =>
          String(d.displayName).toLowerCase().includes(q) ||
          String(d.username).toLowerCase().includes(q),
      );
    }

    const total = items.length;
    const page = items.slice(params.offset, params.offset + params.limit);

    return {
      total,
      items: page.map((d) => ({
        id: String(d.id),
        username: String(d.username),
        email: String(d.email),
        displayName: String(d.displayName),
        avatarUrl: (d.avatarUrl as string | null) ?? null,
        status: String(d.status),
        version: Number(d.version),
        createdAt: String(d.createdAt),
        updatedAt: String(d.updatedAt),
      })),
    };
  }
}

export class InMemoryProfileSearchRepository implements ProfileSearchRepository {
  constructor(private readonly index: InMemoryOpenSearchIndex) {}

  async search(params: {
    query?: string;
    status?: string;
    limit: number;
    offset: number;
  }): Promise<ProfileSearchResult> {
    return this.index.search(params);
  }

  async upsertVersionAware(
    id: string,
    version: number,
    document: Record<string, unknown>,
  ): Promise<boolean> {
    return this.index.upsertVersionAware(id, version, document);
  }

  async delete(id: string): Promise<void> {
    this.index.delete(id);
  }
}
