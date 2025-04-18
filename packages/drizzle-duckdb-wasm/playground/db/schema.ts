import { sql } from 'drizzle-orm'
import {
  bigint,
  // bit,
  boolean,
  char,
  date,
  decimal,
  doublePrecision,
  integer,
  interval,
  json,
  numeric,
  pgTable,
  real,
  smallint,
  text,
  time,
  timestamp,
  uuid,
  varchar,
  vector,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', () => ({
  id: uuid().primaryKey().unique().default(sql`gen_random_uuid()`),
  int16: smallint().notNull().default(0),
  int32: integer().notNull().default(0),
  int64: bigint({ mode: 'number' }).notNull().default(sql`0`),
  int64BigInt: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
  decimal: decimal().notNull().default(sql`0`),
  numeric: numeric().notNull().default(sql`0`),
  real: real().notNull().default(sql`0`),
  double: doublePrecision().notNull().default(sql`0`),
  vector: vector({ dimensions: 4 }).notNull().default(sql`[0,0,0,0]`),
  // Unimplemented type for cast (INTEGER[] -> BIT) from @duckdb/duckdb-wasm
  // bit: bit({ dimensions: 4 }).notNull().default(sql`[0,0,0,0]`),
  bool: boolean().notNull().default(false),
  char: char().notNull().default(''),
  varchar: varchar().notNull().default(''),
  text: text().notNull().default(''),
  json: json().notNull().default(sql`'{}'`),
  date: date().notNull().default(sql`'2020-01-01'`),
  time: time().notNull().default(sql`'00:00:00'`),
  timestamp: timestamp().notNull().default(sql`'2020-01-01 00:00:00'`),
  interval: interval().notNull().default(sql`'1 day'`),
}))

export const nodeUsers = pgTable('node_users', () => ({
  id: uuid().primaryKey().unique().default(sql`gen_random_uuid()`),
  name: text().notNull().default(''),
}))

export const nodePets = pgTable('node_pets', () => ({
  id: uuid().primaryKey().unique().default(sql`gen_random_uuid()`),
  name: text().notNull().default(''),
}))

export const nodeGroups = pgTable('node_groups', () => ({
  id: uuid().primaryKey().unique().default(sql`gen_random_uuid()`),
  name: text().notNull().default(''),
}))

export const edgePets = pgTable('edge_pets', () => ({
  id: uuid().primaryKey().unique().default(sql`gen_random_uuid()`),
  source: uuid(),
  target: uuid(),
}))

export const edgeOwners = pgTable('edge_owners', () => ({
  id: uuid().primaryKey().unique().default(sql`gen_random_uuid()`),
  source: uuid(),
  target: uuid(),
}))

export const edgeUsers = pgTable('edge_users', () => ({
  id: uuid().primaryKey().unique().default(sql`gen_random_uuid()`),
  source: uuid(),
  target: uuid(),
}))

export const edgeGroups = pgTable('edge_groups', () => ({
  id: uuid().primaryKey().unique().default(sql`gen_random_uuid()`),
  source: uuid(),
  target: uuid(),
}))
