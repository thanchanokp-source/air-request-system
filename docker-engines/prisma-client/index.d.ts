
/**
 * Client
**/

import * as runtime from '@prisma/client/runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model MasterBrand
 * 
 */
export type MasterBrand = $Result.DefaultSelection<Prisma.$MasterBrandPayload>
/**
 * Model MasterBU
 * 
 */
export type MasterBU = $Result.DefaultSelection<Prisma.$MasterBUPayload>
/**
 * Model MasterDescription
 * 
 */
export type MasterDescription = $Result.DefaultSelection<Prisma.$MasterDescriptionPayload>
/**
 * Model MasterGMTType
 * 
 */
export type MasterGMTType = $Result.DefaultSelection<Prisma.$MasterGMTTypePayload>
/**
 * Model MasterPort
 * 
 */
export type MasterPort = $Result.DefaultSelection<Prisma.$MasterPortPayload>
/**
 * Model AirRequest
 * 
 */
export type AirRequest = $Result.DefaultSelection<Prisma.$AirRequestPayload>
/**
 * Model ClaimApproval
 * 
 */
export type ClaimApproval = $Result.DefaultSelection<Prisma.$ClaimApprovalPayload>
/**
 * Model HawbGroup
 * 
 */
export type HawbGroup = $Result.DefaultSelection<Prisma.$HawbGroupPayload>
/**
 * Model AirRequestItem
 * 
 */
export type AirRequestItem = $Result.DefaultSelection<Prisma.$AirRequestItemPayload>
/**
 * Model ApprovalLog
 * 
 */
export type ApprovalLog = $Result.DefaultSelection<Prisma.$ApprovalLogPayload>
/**
 * Model RequestAttachment
 * 
 */
export type RequestAttachment = $Result.DefaultSelection<Prisma.$RequestAttachmentPayload>

/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb, ExtArgs>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs>;

  /**
   * `prisma.masterBrand`: Exposes CRUD operations for the **MasterBrand** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MasterBrands
    * const masterBrands = await prisma.masterBrand.findMany()
    * ```
    */
  get masterBrand(): Prisma.MasterBrandDelegate<ExtArgs>;

  /**
   * `prisma.masterBU`: Exposes CRUD operations for the **MasterBU** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MasterBUS
    * const masterBUS = await prisma.masterBU.findMany()
    * ```
    */
  get masterBU(): Prisma.MasterBUDelegate<ExtArgs>;

  /**
   * `prisma.masterDescription`: Exposes CRUD operations for the **MasterDescription** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MasterDescriptions
    * const masterDescriptions = await prisma.masterDescription.findMany()
    * ```
    */
  get masterDescription(): Prisma.MasterDescriptionDelegate<ExtArgs>;

  /**
   * `prisma.masterGMTType`: Exposes CRUD operations for the **MasterGMTType** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MasterGMTTypes
    * const masterGMTTypes = await prisma.masterGMTType.findMany()
    * ```
    */
  get masterGMTType(): Prisma.MasterGMTTypeDelegate<ExtArgs>;

  /**
   * `prisma.masterPort`: Exposes CRUD operations for the **MasterPort** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MasterPorts
    * const masterPorts = await prisma.masterPort.findMany()
    * ```
    */
  get masterPort(): Prisma.MasterPortDelegate<ExtArgs>;

  /**
   * `prisma.airRequest`: Exposes CRUD operations for the **AirRequest** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AirRequests
    * const airRequests = await prisma.airRequest.findMany()
    * ```
    */
  get airRequest(): Prisma.AirRequestDelegate<ExtArgs>;

  /**
   * `prisma.claimApproval`: Exposes CRUD operations for the **ClaimApproval** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ClaimApprovals
    * const claimApprovals = await prisma.claimApproval.findMany()
    * ```
    */
  get claimApproval(): Prisma.ClaimApprovalDelegate<ExtArgs>;

  /**
   * `prisma.hawbGroup`: Exposes CRUD operations for the **HawbGroup** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more HawbGroups
    * const hawbGroups = await prisma.hawbGroup.findMany()
    * ```
    */
  get hawbGroup(): Prisma.HawbGroupDelegate<ExtArgs>;

  /**
   * `prisma.airRequestItem`: Exposes CRUD operations for the **AirRequestItem** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AirRequestItems
    * const airRequestItems = await prisma.airRequestItem.findMany()
    * ```
    */
  get airRequestItem(): Prisma.AirRequestItemDelegate<ExtArgs>;

  /**
   * `prisma.approvalLog`: Exposes CRUD operations for the **ApprovalLog** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ApprovalLogs
    * const approvalLogs = await prisma.approvalLog.findMany()
    * ```
    */
  get approvalLog(): Prisma.ApprovalLogDelegate<ExtArgs>;

  /**
   * `prisma.requestAttachment`: Exposes CRUD operations for the **RequestAttachment** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more RequestAttachments
    * const requestAttachments = await prisma.requestAttachment.findMany()
    * ```
    */
  get requestAttachment(): Prisma.RequestAttachmentDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError
  export import NotFoundError = runtime.NotFoundError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 5.22.0
   * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? K : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    MasterBrand: 'MasterBrand',
    MasterBU: 'MasterBU',
    MasterDescription: 'MasterDescription',
    MasterGMTType: 'MasterGMTType',
    MasterPort: 'MasterPort',
    AirRequest: 'AirRequest',
    ClaimApproval: 'ClaimApproval',
    HawbGroup: 'HawbGroup',
    AirRequestItem: 'AirRequestItem',
    ApprovalLog: 'ApprovalLog',
    RequestAttachment: 'RequestAttachment'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.InternalArgs, clientOptions: PrismaClientOptions }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], this['params']['clientOptions']>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> = {
    meta: {
      modelProps: "user" | "masterBrand" | "masterBU" | "masterDescription" | "masterGMTType" | "masterPort" | "airRequest" | "claimApproval" | "hawbGroup" | "airRequestItem" | "approvalLog" | "requestAttachment"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      MasterBrand: {
        payload: Prisma.$MasterBrandPayload<ExtArgs>
        fields: Prisma.MasterBrandFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MasterBrandFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBrandPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MasterBrandFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBrandPayload>
          }
          findFirst: {
            args: Prisma.MasterBrandFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBrandPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MasterBrandFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBrandPayload>
          }
          findMany: {
            args: Prisma.MasterBrandFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBrandPayload>[]
          }
          create: {
            args: Prisma.MasterBrandCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBrandPayload>
          }
          createMany: {
            args: Prisma.MasterBrandCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MasterBrandCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBrandPayload>[]
          }
          delete: {
            args: Prisma.MasterBrandDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBrandPayload>
          }
          update: {
            args: Prisma.MasterBrandUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBrandPayload>
          }
          deleteMany: {
            args: Prisma.MasterBrandDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MasterBrandUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.MasterBrandUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBrandPayload>
          }
          aggregate: {
            args: Prisma.MasterBrandAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMasterBrand>
          }
          groupBy: {
            args: Prisma.MasterBrandGroupByArgs<ExtArgs>
            result: $Utils.Optional<MasterBrandGroupByOutputType>[]
          }
          count: {
            args: Prisma.MasterBrandCountArgs<ExtArgs>
            result: $Utils.Optional<MasterBrandCountAggregateOutputType> | number
          }
        }
      }
      MasterBU: {
        payload: Prisma.$MasterBUPayload<ExtArgs>
        fields: Prisma.MasterBUFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MasterBUFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBUPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MasterBUFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBUPayload>
          }
          findFirst: {
            args: Prisma.MasterBUFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBUPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MasterBUFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBUPayload>
          }
          findMany: {
            args: Prisma.MasterBUFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBUPayload>[]
          }
          create: {
            args: Prisma.MasterBUCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBUPayload>
          }
          createMany: {
            args: Prisma.MasterBUCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MasterBUCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBUPayload>[]
          }
          delete: {
            args: Prisma.MasterBUDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBUPayload>
          }
          update: {
            args: Prisma.MasterBUUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBUPayload>
          }
          deleteMany: {
            args: Prisma.MasterBUDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MasterBUUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.MasterBUUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterBUPayload>
          }
          aggregate: {
            args: Prisma.MasterBUAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMasterBU>
          }
          groupBy: {
            args: Prisma.MasterBUGroupByArgs<ExtArgs>
            result: $Utils.Optional<MasterBUGroupByOutputType>[]
          }
          count: {
            args: Prisma.MasterBUCountArgs<ExtArgs>
            result: $Utils.Optional<MasterBUCountAggregateOutputType> | number
          }
        }
      }
      MasterDescription: {
        payload: Prisma.$MasterDescriptionPayload<ExtArgs>
        fields: Prisma.MasterDescriptionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MasterDescriptionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterDescriptionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MasterDescriptionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterDescriptionPayload>
          }
          findFirst: {
            args: Prisma.MasterDescriptionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterDescriptionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MasterDescriptionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterDescriptionPayload>
          }
          findMany: {
            args: Prisma.MasterDescriptionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterDescriptionPayload>[]
          }
          create: {
            args: Prisma.MasterDescriptionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterDescriptionPayload>
          }
          createMany: {
            args: Prisma.MasterDescriptionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MasterDescriptionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterDescriptionPayload>[]
          }
          delete: {
            args: Prisma.MasterDescriptionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterDescriptionPayload>
          }
          update: {
            args: Prisma.MasterDescriptionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterDescriptionPayload>
          }
          deleteMany: {
            args: Prisma.MasterDescriptionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MasterDescriptionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.MasterDescriptionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterDescriptionPayload>
          }
          aggregate: {
            args: Prisma.MasterDescriptionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMasterDescription>
          }
          groupBy: {
            args: Prisma.MasterDescriptionGroupByArgs<ExtArgs>
            result: $Utils.Optional<MasterDescriptionGroupByOutputType>[]
          }
          count: {
            args: Prisma.MasterDescriptionCountArgs<ExtArgs>
            result: $Utils.Optional<MasterDescriptionCountAggregateOutputType> | number
          }
        }
      }
      MasterGMTType: {
        payload: Prisma.$MasterGMTTypePayload<ExtArgs>
        fields: Prisma.MasterGMTTypeFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MasterGMTTypeFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterGMTTypePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MasterGMTTypeFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterGMTTypePayload>
          }
          findFirst: {
            args: Prisma.MasterGMTTypeFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterGMTTypePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MasterGMTTypeFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterGMTTypePayload>
          }
          findMany: {
            args: Prisma.MasterGMTTypeFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterGMTTypePayload>[]
          }
          create: {
            args: Prisma.MasterGMTTypeCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterGMTTypePayload>
          }
          createMany: {
            args: Prisma.MasterGMTTypeCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MasterGMTTypeCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterGMTTypePayload>[]
          }
          delete: {
            args: Prisma.MasterGMTTypeDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterGMTTypePayload>
          }
          update: {
            args: Prisma.MasterGMTTypeUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterGMTTypePayload>
          }
          deleteMany: {
            args: Prisma.MasterGMTTypeDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MasterGMTTypeUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.MasterGMTTypeUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterGMTTypePayload>
          }
          aggregate: {
            args: Prisma.MasterGMTTypeAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMasterGMTType>
          }
          groupBy: {
            args: Prisma.MasterGMTTypeGroupByArgs<ExtArgs>
            result: $Utils.Optional<MasterGMTTypeGroupByOutputType>[]
          }
          count: {
            args: Prisma.MasterGMTTypeCountArgs<ExtArgs>
            result: $Utils.Optional<MasterGMTTypeCountAggregateOutputType> | number
          }
        }
      }
      MasterPort: {
        payload: Prisma.$MasterPortPayload<ExtArgs>
        fields: Prisma.MasterPortFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MasterPortFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterPortPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MasterPortFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterPortPayload>
          }
          findFirst: {
            args: Prisma.MasterPortFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterPortPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MasterPortFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterPortPayload>
          }
          findMany: {
            args: Prisma.MasterPortFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterPortPayload>[]
          }
          create: {
            args: Prisma.MasterPortCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterPortPayload>
          }
          createMany: {
            args: Prisma.MasterPortCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MasterPortCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterPortPayload>[]
          }
          delete: {
            args: Prisma.MasterPortDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterPortPayload>
          }
          update: {
            args: Prisma.MasterPortUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterPortPayload>
          }
          deleteMany: {
            args: Prisma.MasterPortDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MasterPortUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.MasterPortUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MasterPortPayload>
          }
          aggregate: {
            args: Prisma.MasterPortAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMasterPort>
          }
          groupBy: {
            args: Prisma.MasterPortGroupByArgs<ExtArgs>
            result: $Utils.Optional<MasterPortGroupByOutputType>[]
          }
          count: {
            args: Prisma.MasterPortCountArgs<ExtArgs>
            result: $Utils.Optional<MasterPortCountAggregateOutputType> | number
          }
        }
      }
      AirRequest: {
        payload: Prisma.$AirRequestPayload<ExtArgs>
        fields: Prisma.AirRequestFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AirRequestFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AirRequestFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestPayload>
          }
          findFirst: {
            args: Prisma.AirRequestFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AirRequestFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestPayload>
          }
          findMany: {
            args: Prisma.AirRequestFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestPayload>[]
          }
          create: {
            args: Prisma.AirRequestCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestPayload>
          }
          createMany: {
            args: Prisma.AirRequestCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AirRequestCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestPayload>[]
          }
          delete: {
            args: Prisma.AirRequestDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestPayload>
          }
          update: {
            args: Prisma.AirRequestUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestPayload>
          }
          deleteMany: {
            args: Prisma.AirRequestDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AirRequestUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.AirRequestUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestPayload>
          }
          aggregate: {
            args: Prisma.AirRequestAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAirRequest>
          }
          groupBy: {
            args: Prisma.AirRequestGroupByArgs<ExtArgs>
            result: $Utils.Optional<AirRequestGroupByOutputType>[]
          }
          count: {
            args: Prisma.AirRequestCountArgs<ExtArgs>
            result: $Utils.Optional<AirRequestCountAggregateOutputType> | number
          }
        }
      }
      ClaimApproval: {
        payload: Prisma.$ClaimApprovalPayload<ExtArgs>
        fields: Prisma.ClaimApprovalFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ClaimApprovalFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimApprovalPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ClaimApprovalFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimApprovalPayload>
          }
          findFirst: {
            args: Prisma.ClaimApprovalFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimApprovalPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ClaimApprovalFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimApprovalPayload>
          }
          findMany: {
            args: Prisma.ClaimApprovalFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimApprovalPayload>[]
          }
          create: {
            args: Prisma.ClaimApprovalCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimApprovalPayload>
          }
          createMany: {
            args: Prisma.ClaimApprovalCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ClaimApprovalCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimApprovalPayload>[]
          }
          delete: {
            args: Prisma.ClaimApprovalDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimApprovalPayload>
          }
          update: {
            args: Prisma.ClaimApprovalUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimApprovalPayload>
          }
          deleteMany: {
            args: Prisma.ClaimApprovalDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ClaimApprovalUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ClaimApprovalUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClaimApprovalPayload>
          }
          aggregate: {
            args: Prisma.ClaimApprovalAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateClaimApproval>
          }
          groupBy: {
            args: Prisma.ClaimApprovalGroupByArgs<ExtArgs>
            result: $Utils.Optional<ClaimApprovalGroupByOutputType>[]
          }
          count: {
            args: Prisma.ClaimApprovalCountArgs<ExtArgs>
            result: $Utils.Optional<ClaimApprovalCountAggregateOutputType> | number
          }
        }
      }
      HawbGroup: {
        payload: Prisma.$HawbGroupPayload<ExtArgs>
        fields: Prisma.HawbGroupFieldRefs
        operations: {
          findUnique: {
            args: Prisma.HawbGroupFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HawbGroupPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.HawbGroupFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HawbGroupPayload>
          }
          findFirst: {
            args: Prisma.HawbGroupFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HawbGroupPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.HawbGroupFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HawbGroupPayload>
          }
          findMany: {
            args: Prisma.HawbGroupFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HawbGroupPayload>[]
          }
          create: {
            args: Prisma.HawbGroupCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HawbGroupPayload>
          }
          createMany: {
            args: Prisma.HawbGroupCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.HawbGroupCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HawbGroupPayload>[]
          }
          delete: {
            args: Prisma.HawbGroupDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HawbGroupPayload>
          }
          update: {
            args: Prisma.HawbGroupUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HawbGroupPayload>
          }
          deleteMany: {
            args: Prisma.HawbGroupDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.HawbGroupUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.HawbGroupUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HawbGroupPayload>
          }
          aggregate: {
            args: Prisma.HawbGroupAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateHawbGroup>
          }
          groupBy: {
            args: Prisma.HawbGroupGroupByArgs<ExtArgs>
            result: $Utils.Optional<HawbGroupGroupByOutputType>[]
          }
          count: {
            args: Prisma.HawbGroupCountArgs<ExtArgs>
            result: $Utils.Optional<HawbGroupCountAggregateOutputType> | number
          }
        }
      }
      AirRequestItem: {
        payload: Prisma.$AirRequestItemPayload<ExtArgs>
        fields: Prisma.AirRequestItemFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AirRequestItemFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestItemPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AirRequestItemFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestItemPayload>
          }
          findFirst: {
            args: Prisma.AirRequestItemFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestItemPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AirRequestItemFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestItemPayload>
          }
          findMany: {
            args: Prisma.AirRequestItemFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestItemPayload>[]
          }
          create: {
            args: Prisma.AirRequestItemCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestItemPayload>
          }
          createMany: {
            args: Prisma.AirRequestItemCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AirRequestItemCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestItemPayload>[]
          }
          delete: {
            args: Prisma.AirRequestItemDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestItemPayload>
          }
          update: {
            args: Prisma.AirRequestItemUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestItemPayload>
          }
          deleteMany: {
            args: Prisma.AirRequestItemDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AirRequestItemUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.AirRequestItemUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AirRequestItemPayload>
          }
          aggregate: {
            args: Prisma.AirRequestItemAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAirRequestItem>
          }
          groupBy: {
            args: Prisma.AirRequestItemGroupByArgs<ExtArgs>
            result: $Utils.Optional<AirRequestItemGroupByOutputType>[]
          }
          count: {
            args: Prisma.AirRequestItemCountArgs<ExtArgs>
            result: $Utils.Optional<AirRequestItemCountAggregateOutputType> | number
          }
        }
      }
      ApprovalLog: {
        payload: Prisma.$ApprovalLogPayload<ExtArgs>
        fields: Prisma.ApprovalLogFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ApprovalLogFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ApprovalLogPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ApprovalLogFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ApprovalLogPayload>
          }
          findFirst: {
            args: Prisma.ApprovalLogFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ApprovalLogPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ApprovalLogFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ApprovalLogPayload>
          }
          findMany: {
            args: Prisma.ApprovalLogFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ApprovalLogPayload>[]
          }
          create: {
            args: Prisma.ApprovalLogCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ApprovalLogPayload>
          }
          createMany: {
            args: Prisma.ApprovalLogCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ApprovalLogCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ApprovalLogPayload>[]
          }
          delete: {
            args: Prisma.ApprovalLogDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ApprovalLogPayload>
          }
          update: {
            args: Prisma.ApprovalLogUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ApprovalLogPayload>
          }
          deleteMany: {
            args: Prisma.ApprovalLogDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ApprovalLogUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ApprovalLogUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ApprovalLogPayload>
          }
          aggregate: {
            args: Prisma.ApprovalLogAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateApprovalLog>
          }
          groupBy: {
            args: Prisma.ApprovalLogGroupByArgs<ExtArgs>
            result: $Utils.Optional<ApprovalLogGroupByOutputType>[]
          }
          count: {
            args: Prisma.ApprovalLogCountArgs<ExtArgs>
            result: $Utils.Optional<ApprovalLogCountAggregateOutputType> | number
          }
        }
      }
      RequestAttachment: {
        payload: Prisma.$RequestAttachmentPayload<ExtArgs>
        fields: Prisma.RequestAttachmentFieldRefs
        operations: {
          findUnique: {
            args: Prisma.RequestAttachmentFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RequestAttachmentPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.RequestAttachmentFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RequestAttachmentPayload>
          }
          findFirst: {
            args: Prisma.RequestAttachmentFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RequestAttachmentPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.RequestAttachmentFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RequestAttachmentPayload>
          }
          findMany: {
            args: Prisma.RequestAttachmentFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RequestAttachmentPayload>[]
          }
          create: {
            args: Prisma.RequestAttachmentCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RequestAttachmentPayload>
          }
          createMany: {
            args: Prisma.RequestAttachmentCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.RequestAttachmentCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RequestAttachmentPayload>[]
          }
          delete: {
            args: Prisma.RequestAttachmentDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RequestAttachmentPayload>
          }
          update: {
            args: Prisma.RequestAttachmentUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RequestAttachmentPayload>
          }
          deleteMany: {
            args: Prisma.RequestAttachmentDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.RequestAttachmentUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.RequestAttachmentUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RequestAttachmentPayload>
          }
          aggregate: {
            args: Prisma.RequestAttachmentAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateRequestAttachment>
          }
          groupBy: {
            args: Prisma.RequestAttachmentGroupByArgs<ExtArgs>
            result: $Utils.Optional<RequestAttachmentGroupByOutputType>[]
          }
          count: {
            args: Prisma.RequestAttachmentCountArgs<ExtArgs>
            result: $Utils.Optional<RequestAttachmentCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
  }


  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    airRequests: number
    approvals: number
    claimApprovals: number
    attachments: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    airRequests?: boolean | UserCountOutputTypeCountAirRequestsArgs
    approvals?: boolean | UserCountOutputTypeCountApprovalsArgs
    claimApprovals?: boolean | UserCountOutputTypeCountClaimApprovalsArgs
    attachments?: boolean | UserCountOutputTypeCountAttachmentsArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountAirRequestsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AirRequestWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountApprovalsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ApprovalLogWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountClaimApprovalsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClaimApprovalWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountAttachmentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RequestAttachmentWhereInput
  }


  /**
   * Count Type AirRequestCountOutputType
   */

  export type AirRequestCountOutputType = {
    items: number
    approvalLogs: number
    attachments: number
    hawbGroups: number
  }

  export type AirRequestCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    items?: boolean | AirRequestCountOutputTypeCountItemsArgs
    approvalLogs?: boolean | AirRequestCountOutputTypeCountApprovalLogsArgs
    attachments?: boolean | AirRequestCountOutputTypeCountAttachmentsArgs
    hawbGroups?: boolean | AirRequestCountOutputTypeCountHawbGroupsArgs
  }

  // Custom InputTypes
  /**
   * AirRequestCountOutputType without action
   */
  export type AirRequestCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestCountOutputType
     */
    select?: AirRequestCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * AirRequestCountOutputType without action
   */
  export type AirRequestCountOutputTypeCountItemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AirRequestItemWhereInput
  }

  /**
   * AirRequestCountOutputType without action
   */
  export type AirRequestCountOutputTypeCountApprovalLogsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ApprovalLogWhereInput
  }

  /**
   * AirRequestCountOutputType without action
   */
  export type AirRequestCountOutputTypeCountAttachmentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RequestAttachmentWhereInput
  }

  /**
   * AirRequestCountOutputType without action
   */
  export type AirRequestCountOutputTypeCountHawbGroupsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: HawbGroupWhereInput
  }


  /**
   * Count Type HawbGroupCountOutputType
   */

  export type HawbGroupCountOutputType = {
    items: number
  }

  export type HawbGroupCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    items?: boolean | HawbGroupCountOutputTypeCountItemsArgs
  }

  // Custom InputTypes
  /**
   * HawbGroupCountOutputType without action
   */
  export type HawbGroupCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HawbGroupCountOutputType
     */
    select?: HawbGroupCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * HawbGroupCountOutputType without action
   */
  export type HawbGroupCountOutputTypeCountItemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AirRequestItemWhereInput
  }


  /**
   * Count Type AirRequestItemCountOutputType
   */

  export type AirRequestItemCountOutputType = {
    claimApprovals: number
  }

  export type AirRequestItemCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    claimApprovals?: boolean | AirRequestItemCountOutputTypeCountClaimApprovalsArgs
  }

  // Custom InputTypes
  /**
   * AirRequestItemCountOutputType without action
   */
  export type AirRequestItemCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestItemCountOutputType
     */
    select?: AirRequestItemCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * AirRequestItemCountOutputType without action
   */
  export type AirRequestItemCountOutputTypeCountClaimApprovalsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClaimApprovalWhereInput
  }


  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _avg: UserAvgAggregateOutputType | null
    _sum: UserSumAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserAvgAggregateOutputType = {
    priority: number | null
  }

  export type UserSumAggregateOutputType = {
    priority: number | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    name: string | null
    email: string | null
    password: string | null
    role: string | null
    claimDepartment: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
    priority: number | null
    bu: string | null
    procurementType: string | null
    resetToken: string | null
    resetTokenExpiry: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    name: string | null
    email: string | null
    password: string | null
    role: string | null
    claimDepartment: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
    priority: number | null
    bu: string | null
    procurementType: string | null
    resetToken: string | null
    resetTokenExpiry: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    name: number
    email: number
    password: number
    role: number
    claimDepartment: number
    isActive: number
    createdAt: number
    updatedAt: number
    priority: number
    bu: number
    procurementType: number
    resetToken: number
    resetTokenExpiry: number
    _all: number
  }


  export type UserAvgAggregateInputType = {
    priority?: true
  }

  export type UserSumAggregateInputType = {
    priority?: true
  }

  export type UserMinAggregateInputType = {
    id?: true
    name?: true
    email?: true
    password?: true
    role?: true
    claimDepartment?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    priority?: true
    bu?: true
    procurementType?: true
    resetToken?: true
    resetTokenExpiry?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    name?: true
    email?: true
    password?: true
    role?: true
    claimDepartment?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    priority?: true
    bu?: true
    procurementType?: true
    resetToken?: true
    resetTokenExpiry?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    name?: true
    email?: true
    password?: true
    role?: true
    claimDepartment?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    priority?: true
    bu?: true
    procurementType?: true
    resetToken?: true
    resetTokenExpiry?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UserAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UserSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _avg?: UserAvgAggregateInputType
    _sum?: UserSumAggregateInputType
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    name: string | null
    email: string
    password: string | null
    role: string
    claimDepartment: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    priority: number | null
    bu: string
    procurementType: string | null
    resetToken: string | null
    resetTokenExpiry: Date | null
    _count: UserCountAggregateOutputType | null
    _avg: UserAvgAggregateOutputType | null
    _sum: UserSumAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    password?: boolean
    role?: boolean
    claimDepartment?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    priority?: boolean
    bu?: boolean
    procurementType?: boolean
    resetToken?: boolean
    resetTokenExpiry?: boolean
    airRequests?: boolean | User$airRequestsArgs<ExtArgs>
    approvals?: boolean | User$approvalsArgs<ExtArgs>
    claimApprovals?: boolean | User$claimApprovalsArgs<ExtArgs>
    attachments?: boolean | User$attachmentsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    password?: boolean
    role?: boolean
    claimDepartment?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    priority?: boolean
    bu?: boolean
    procurementType?: boolean
    resetToken?: boolean
    resetTokenExpiry?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    name?: boolean
    email?: boolean
    password?: boolean
    role?: boolean
    claimDepartment?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    priority?: boolean
    bu?: boolean
    procurementType?: boolean
    resetToken?: boolean
    resetTokenExpiry?: boolean
  }

  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    airRequests?: boolean | User$airRequestsArgs<ExtArgs>
    approvals?: boolean | User$approvalsArgs<ExtArgs>
    claimApprovals?: boolean | User$claimApprovalsArgs<ExtArgs>
    attachments?: boolean | User$attachmentsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      airRequests: Prisma.$AirRequestPayload<ExtArgs>[]
      approvals: Prisma.$ApprovalLogPayload<ExtArgs>[]
      claimApprovals: Prisma.$ClaimApprovalPayload<ExtArgs>[]
      attachments: Prisma.$RequestAttachmentPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string | null
      email: string
      password: string | null
      role: string
      claimDepartment: string | null
      isActive: boolean
      createdAt: Date
      updatedAt: Date
      priority: number | null
      bu: string
      procurementType: string | null
      resetToken: string | null
      resetTokenExpiry: Date | null
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    airRequests<T extends User$airRequestsArgs<ExtArgs> = {}>(args?: Subset<T, User$airRequestsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "findMany"> | Null>
    approvals<T extends User$approvalsArgs<ExtArgs> = {}>(args?: Subset<T, User$approvalsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ApprovalLogPayload<ExtArgs>, T, "findMany"> | Null>
    claimApprovals<T extends User$claimApprovalsArgs<ExtArgs> = {}>(args?: Subset<T, User$claimApprovalsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClaimApprovalPayload<ExtArgs>, T, "findMany"> | Null>
    attachments<T extends User$attachmentsArgs<ExtArgs> = {}>(args?: Subset<T, User$attachmentsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RequestAttachmentPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */ 
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly name: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly password: FieldRef<"User", 'String'>
    readonly role: FieldRef<"User", 'String'>
    readonly claimDepartment: FieldRef<"User", 'String'>
    readonly isActive: FieldRef<"User", 'Boolean'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
    readonly priority: FieldRef<"User", 'Int'>
    readonly bu: FieldRef<"User", 'String'>
    readonly procurementType: FieldRef<"User", 'String'>
    readonly resetToken: FieldRef<"User", 'String'>
    readonly resetTokenExpiry: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
  }

  /**
   * User.airRequests
   */
  export type User$airRequestsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequest
     */
    select?: AirRequestSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestInclude<ExtArgs> | null
    where?: AirRequestWhereInput
    orderBy?: AirRequestOrderByWithRelationInput | AirRequestOrderByWithRelationInput[]
    cursor?: AirRequestWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AirRequestScalarFieldEnum | AirRequestScalarFieldEnum[]
  }

  /**
   * User.approvals
   */
  export type User$approvalsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ApprovalLog
     */
    select?: ApprovalLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ApprovalLogInclude<ExtArgs> | null
    where?: ApprovalLogWhereInput
    orderBy?: ApprovalLogOrderByWithRelationInput | ApprovalLogOrderByWithRelationInput[]
    cursor?: ApprovalLogWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ApprovalLogScalarFieldEnum | ApprovalLogScalarFieldEnum[]
  }

  /**
   * User.claimApprovals
   */
  export type User$claimApprovalsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimApproval
     */
    select?: ClaimApprovalSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimApprovalInclude<ExtArgs> | null
    where?: ClaimApprovalWhereInput
    orderBy?: ClaimApprovalOrderByWithRelationInput | ClaimApprovalOrderByWithRelationInput[]
    cursor?: ClaimApprovalWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ClaimApprovalScalarFieldEnum | ClaimApprovalScalarFieldEnum[]
  }

  /**
   * User.attachments
   */
  export type User$attachmentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RequestAttachment
     */
    select?: RequestAttachmentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RequestAttachmentInclude<ExtArgs> | null
    where?: RequestAttachmentWhereInput
    orderBy?: RequestAttachmentOrderByWithRelationInput | RequestAttachmentOrderByWithRelationInput[]
    cursor?: RequestAttachmentWhereUniqueInput
    take?: number
    skip?: number
    distinct?: RequestAttachmentScalarFieldEnum | RequestAttachmentScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model MasterBrand
   */

  export type AggregateMasterBrand = {
    _count: MasterBrandCountAggregateOutputType | null
    _min: MasterBrandMinAggregateOutputType | null
    _max: MasterBrandMaxAggregateOutputType | null
  }

  export type MasterBrandMinAggregateOutputType = {
    id: string | null
    name: string | null
    isActive: boolean | null
  }

  export type MasterBrandMaxAggregateOutputType = {
    id: string | null
    name: string | null
    isActive: boolean | null
  }

  export type MasterBrandCountAggregateOutputType = {
    id: number
    name: number
    isActive: number
    _all: number
  }


  export type MasterBrandMinAggregateInputType = {
    id?: true
    name?: true
    isActive?: true
  }

  export type MasterBrandMaxAggregateInputType = {
    id?: true
    name?: true
    isActive?: true
  }

  export type MasterBrandCountAggregateInputType = {
    id?: true
    name?: true
    isActive?: true
    _all?: true
  }

  export type MasterBrandAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MasterBrand to aggregate.
     */
    where?: MasterBrandWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterBrands to fetch.
     */
    orderBy?: MasterBrandOrderByWithRelationInput | MasterBrandOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MasterBrandWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterBrands from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterBrands.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MasterBrands
    **/
    _count?: true | MasterBrandCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MasterBrandMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MasterBrandMaxAggregateInputType
  }

  export type GetMasterBrandAggregateType<T extends MasterBrandAggregateArgs> = {
        [P in keyof T & keyof AggregateMasterBrand]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMasterBrand[P]>
      : GetScalarType<T[P], AggregateMasterBrand[P]>
  }




  export type MasterBrandGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MasterBrandWhereInput
    orderBy?: MasterBrandOrderByWithAggregationInput | MasterBrandOrderByWithAggregationInput[]
    by: MasterBrandScalarFieldEnum[] | MasterBrandScalarFieldEnum
    having?: MasterBrandScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MasterBrandCountAggregateInputType | true
    _min?: MasterBrandMinAggregateInputType
    _max?: MasterBrandMaxAggregateInputType
  }

  export type MasterBrandGroupByOutputType = {
    id: string
    name: string
    isActive: boolean
    _count: MasterBrandCountAggregateOutputType | null
    _min: MasterBrandMinAggregateOutputType | null
    _max: MasterBrandMaxAggregateOutputType | null
  }

  type GetMasterBrandGroupByPayload<T extends MasterBrandGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MasterBrandGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MasterBrandGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MasterBrandGroupByOutputType[P]>
            : GetScalarType<T[P], MasterBrandGroupByOutputType[P]>
        }
      >
    >


  export type MasterBrandSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    isActive?: boolean
  }, ExtArgs["result"]["masterBrand"]>

  export type MasterBrandSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    isActive?: boolean
  }, ExtArgs["result"]["masterBrand"]>

  export type MasterBrandSelectScalar = {
    id?: boolean
    name?: boolean
    isActive?: boolean
  }


  export type $MasterBrandPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "MasterBrand"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      isActive: boolean
    }, ExtArgs["result"]["masterBrand"]>
    composites: {}
  }

  type MasterBrandGetPayload<S extends boolean | null | undefined | MasterBrandDefaultArgs> = $Result.GetResult<Prisma.$MasterBrandPayload, S>

  type MasterBrandCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<MasterBrandFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: MasterBrandCountAggregateInputType | true
    }

  export interface MasterBrandDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MasterBrand'], meta: { name: 'MasterBrand' } }
    /**
     * Find zero or one MasterBrand that matches the filter.
     * @param {MasterBrandFindUniqueArgs} args - Arguments to find a MasterBrand
     * @example
     * // Get one MasterBrand
     * const masterBrand = await prisma.masterBrand.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MasterBrandFindUniqueArgs>(args: SelectSubset<T, MasterBrandFindUniqueArgs<ExtArgs>>): Prisma__MasterBrandClient<$Result.GetResult<Prisma.$MasterBrandPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one MasterBrand that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {MasterBrandFindUniqueOrThrowArgs} args - Arguments to find a MasterBrand
     * @example
     * // Get one MasterBrand
     * const masterBrand = await prisma.masterBrand.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MasterBrandFindUniqueOrThrowArgs>(args: SelectSubset<T, MasterBrandFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MasterBrandClient<$Result.GetResult<Prisma.$MasterBrandPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first MasterBrand that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterBrandFindFirstArgs} args - Arguments to find a MasterBrand
     * @example
     * // Get one MasterBrand
     * const masterBrand = await prisma.masterBrand.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MasterBrandFindFirstArgs>(args?: SelectSubset<T, MasterBrandFindFirstArgs<ExtArgs>>): Prisma__MasterBrandClient<$Result.GetResult<Prisma.$MasterBrandPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first MasterBrand that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterBrandFindFirstOrThrowArgs} args - Arguments to find a MasterBrand
     * @example
     * // Get one MasterBrand
     * const masterBrand = await prisma.masterBrand.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MasterBrandFindFirstOrThrowArgs>(args?: SelectSubset<T, MasterBrandFindFirstOrThrowArgs<ExtArgs>>): Prisma__MasterBrandClient<$Result.GetResult<Prisma.$MasterBrandPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more MasterBrands that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterBrandFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MasterBrands
     * const masterBrands = await prisma.masterBrand.findMany()
     * 
     * // Get first 10 MasterBrands
     * const masterBrands = await prisma.masterBrand.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const masterBrandWithIdOnly = await prisma.masterBrand.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MasterBrandFindManyArgs>(args?: SelectSubset<T, MasterBrandFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MasterBrandPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a MasterBrand.
     * @param {MasterBrandCreateArgs} args - Arguments to create a MasterBrand.
     * @example
     * // Create one MasterBrand
     * const MasterBrand = await prisma.masterBrand.create({
     *   data: {
     *     // ... data to create a MasterBrand
     *   }
     * })
     * 
     */
    create<T extends MasterBrandCreateArgs>(args: SelectSubset<T, MasterBrandCreateArgs<ExtArgs>>): Prisma__MasterBrandClient<$Result.GetResult<Prisma.$MasterBrandPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many MasterBrands.
     * @param {MasterBrandCreateManyArgs} args - Arguments to create many MasterBrands.
     * @example
     * // Create many MasterBrands
     * const masterBrand = await prisma.masterBrand.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MasterBrandCreateManyArgs>(args?: SelectSubset<T, MasterBrandCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many MasterBrands and returns the data saved in the database.
     * @param {MasterBrandCreateManyAndReturnArgs} args - Arguments to create many MasterBrands.
     * @example
     * // Create many MasterBrands
     * const masterBrand = await prisma.masterBrand.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many MasterBrands and only return the `id`
     * const masterBrandWithIdOnly = await prisma.masterBrand.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MasterBrandCreateManyAndReturnArgs>(args?: SelectSubset<T, MasterBrandCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MasterBrandPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a MasterBrand.
     * @param {MasterBrandDeleteArgs} args - Arguments to delete one MasterBrand.
     * @example
     * // Delete one MasterBrand
     * const MasterBrand = await prisma.masterBrand.delete({
     *   where: {
     *     // ... filter to delete one MasterBrand
     *   }
     * })
     * 
     */
    delete<T extends MasterBrandDeleteArgs>(args: SelectSubset<T, MasterBrandDeleteArgs<ExtArgs>>): Prisma__MasterBrandClient<$Result.GetResult<Prisma.$MasterBrandPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one MasterBrand.
     * @param {MasterBrandUpdateArgs} args - Arguments to update one MasterBrand.
     * @example
     * // Update one MasterBrand
     * const masterBrand = await prisma.masterBrand.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MasterBrandUpdateArgs>(args: SelectSubset<T, MasterBrandUpdateArgs<ExtArgs>>): Prisma__MasterBrandClient<$Result.GetResult<Prisma.$MasterBrandPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more MasterBrands.
     * @param {MasterBrandDeleteManyArgs} args - Arguments to filter MasterBrands to delete.
     * @example
     * // Delete a few MasterBrands
     * const { count } = await prisma.masterBrand.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MasterBrandDeleteManyArgs>(args?: SelectSubset<T, MasterBrandDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MasterBrands.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterBrandUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MasterBrands
     * const masterBrand = await prisma.masterBrand.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MasterBrandUpdateManyArgs>(args: SelectSubset<T, MasterBrandUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one MasterBrand.
     * @param {MasterBrandUpsertArgs} args - Arguments to update or create a MasterBrand.
     * @example
     * // Update or create a MasterBrand
     * const masterBrand = await prisma.masterBrand.upsert({
     *   create: {
     *     // ... data to create a MasterBrand
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MasterBrand we want to update
     *   }
     * })
     */
    upsert<T extends MasterBrandUpsertArgs>(args: SelectSubset<T, MasterBrandUpsertArgs<ExtArgs>>): Prisma__MasterBrandClient<$Result.GetResult<Prisma.$MasterBrandPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of MasterBrands.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterBrandCountArgs} args - Arguments to filter MasterBrands to count.
     * @example
     * // Count the number of MasterBrands
     * const count = await prisma.masterBrand.count({
     *   where: {
     *     // ... the filter for the MasterBrands we want to count
     *   }
     * })
    **/
    count<T extends MasterBrandCountArgs>(
      args?: Subset<T, MasterBrandCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MasterBrandCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MasterBrand.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterBrandAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MasterBrandAggregateArgs>(args: Subset<T, MasterBrandAggregateArgs>): Prisma.PrismaPromise<GetMasterBrandAggregateType<T>>

    /**
     * Group by MasterBrand.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterBrandGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MasterBrandGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MasterBrandGroupByArgs['orderBy'] }
        : { orderBy?: MasterBrandGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MasterBrandGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMasterBrandGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MasterBrand model
   */
  readonly fields: MasterBrandFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MasterBrand.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MasterBrandClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the MasterBrand model
   */ 
  interface MasterBrandFieldRefs {
    readonly id: FieldRef<"MasterBrand", 'String'>
    readonly name: FieldRef<"MasterBrand", 'String'>
    readonly isActive: FieldRef<"MasterBrand", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * MasterBrand findUnique
   */
  export type MasterBrandFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBrand
     */
    select?: MasterBrandSelect<ExtArgs> | null
    /**
     * Filter, which MasterBrand to fetch.
     */
    where: MasterBrandWhereUniqueInput
  }

  /**
   * MasterBrand findUniqueOrThrow
   */
  export type MasterBrandFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBrand
     */
    select?: MasterBrandSelect<ExtArgs> | null
    /**
     * Filter, which MasterBrand to fetch.
     */
    where: MasterBrandWhereUniqueInput
  }

  /**
   * MasterBrand findFirst
   */
  export type MasterBrandFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBrand
     */
    select?: MasterBrandSelect<ExtArgs> | null
    /**
     * Filter, which MasterBrand to fetch.
     */
    where?: MasterBrandWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterBrands to fetch.
     */
    orderBy?: MasterBrandOrderByWithRelationInput | MasterBrandOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MasterBrands.
     */
    cursor?: MasterBrandWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterBrands from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterBrands.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MasterBrands.
     */
    distinct?: MasterBrandScalarFieldEnum | MasterBrandScalarFieldEnum[]
  }

  /**
   * MasterBrand findFirstOrThrow
   */
  export type MasterBrandFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBrand
     */
    select?: MasterBrandSelect<ExtArgs> | null
    /**
     * Filter, which MasterBrand to fetch.
     */
    where?: MasterBrandWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterBrands to fetch.
     */
    orderBy?: MasterBrandOrderByWithRelationInput | MasterBrandOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MasterBrands.
     */
    cursor?: MasterBrandWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterBrands from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterBrands.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MasterBrands.
     */
    distinct?: MasterBrandScalarFieldEnum | MasterBrandScalarFieldEnum[]
  }

  /**
   * MasterBrand findMany
   */
  export type MasterBrandFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBrand
     */
    select?: MasterBrandSelect<ExtArgs> | null
    /**
     * Filter, which MasterBrands to fetch.
     */
    where?: MasterBrandWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterBrands to fetch.
     */
    orderBy?: MasterBrandOrderByWithRelationInput | MasterBrandOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MasterBrands.
     */
    cursor?: MasterBrandWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterBrands from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterBrands.
     */
    skip?: number
    distinct?: MasterBrandScalarFieldEnum | MasterBrandScalarFieldEnum[]
  }

  /**
   * MasterBrand create
   */
  export type MasterBrandCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBrand
     */
    select?: MasterBrandSelect<ExtArgs> | null
    /**
     * The data needed to create a MasterBrand.
     */
    data: XOR<MasterBrandCreateInput, MasterBrandUncheckedCreateInput>
  }

  /**
   * MasterBrand createMany
   */
  export type MasterBrandCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MasterBrands.
     */
    data: MasterBrandCreateManyInput | MasterBrandCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MasterBrand createManyAndReturn
   */
  export type MasterBrandCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBrand
     */
    select?: MasterBrandSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many MasterBrands.
     */
    data: MasterBrandCreateManyInput | MasterBrandCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MasterBrand update
   */
  export type MasterBrandUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBrand
     */
    select?: MasterBrandSelect<ExtArgs> | null
    /**
     * The data needed to update a MasterBrand.
     */
    data: XOR<MasterBrandUpdateInput, MasterBrandUncheckedUpdateInput>
    /**
     * Choose, which MasterBrand to update.
     */
    where: MasterBrandWhereUniqueInput
  }

  /**
   * MasterBrand updateMany
   */
  export type MasterBrandUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MasterBrands.
     */
    data: XOR<MasterBrandUpdateManyMutationInput, MasterBrandUncheckedUpdateManyInput>
    /**
     * Filter which MasterBrands to update
     */
    where?: MasterBrandWhereInput
  }

  /**
   * MasterBrand upsert
   */
  export type MasterBrandUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBrand
     */
    select?: MasterBrandSelect<ExtArgs> | null
    /**
     * The filter to search for the MasterBrand to update in case it exists.
     */
    where: MasterBrandWhereUniqueInput
    /**
     * In case the MasterBrand found by the `where` argument doesn't exist, create a new MasterBrand with this data.
     */
    create: XOR<MasterBrandCreateInput, MasterBrandUncheckedCreateInput>
    /**
     * In case the MasterBrand was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MasterBrandUpdateInput, MasterBrandUncheckedUpdateInput>
  }

  /**
   * MasterBrand delete
   */
  export type MasterBrandDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBrand
     */
    select?: MasterBrandSelect<ExtArgs> | null
    /**
     * Filter which MasterBrand to delete.
     */
    where: MasterBrandWhereUniqueInput
  }

  /**
   * MasterBrand deleteMany
   */
  export type MasterBrandDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MasterBrands to delete
     */
    where?: MasterBrandWhereInput
  }

  /**
   * MasterBrand without action
   */
  export type MasterBrandDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBrand
     */
    select?: MasterBrandSelect<ExtArgs> | null
  }


  /**
   * Model MasterBU
   */

  export type AggregateMasterBU = {
    _count: MasterBUCountAggregateOutputType | null
    _min: MasterBUMinAggregateOutputType | null
    _max: MasterBUMaxAggregateOutputType | null
  }

  export type MasterBUMinAggregateOutputType = {
    id: string | null
    name: string | null
    isActive: boolean | null
  }

  export type MasterBUMaxAggregateOutputType = {
    id: string | null
    name: string | null
    isActive: boolean | null
  }

  export type MasterBUCountAggregateOutputType = {
    id: number
    name: number
    isActive: number
    _all: number
  }


  export type MasterBUMinAggregateInputType = {
    id?: true
    name?: true
    isActive?: true
  }

  export type MasterBUMaxAggregateInputType = {
    id?: true
    name?: true
    isActive?: true
  }

  export type MasterBUCountAggregateInputType = {
    id?: true
    name?: true
    isActive?: true
    _all?: true
  }

  export type MasterBUAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MasterBU to aggregate.
     */
    where?: MasterBUWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterBUS to fetch.
     */
    orderBy?: MasterBUOrderByWithRelationInput | MasterBUOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MasterBUWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterBUS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterBUS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MasterBUS
    **/
    _count?: true | MasterBUCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MasterBUMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MasterBUMaxAggregateInputType
  }

  export type GetMasterBUAggregateType<T extends MasterBUAggregateArgs> = {
        [P in keyof T & keyof AggregateMasterBU]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMasterBU[P]>
      : GetScalarType<T[P], AggregateMasterBU[P]>
  }




  export type MasterBUGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MasterBUWhereInput
    orderBy?: MasterBUOrderByWithAggregationInput | MasterBUOrderByWithAggregationInput[]
    by: MasterBUScalarFieldEnum[] | MasterBUScalarFieldEnum
    having?: MasterBUScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MasterBUCountAggregateInputType | true
    _min?: MasterBUMinAggregateInputType
    _max?: MasterBUMaxAggregateInputType
  }

  export type MasterBUGroupByOutputType = {
    id: string
    name: string
    isActive: boolean
    _count: MasterBUCountAggregateOutputType | null
    _min: MasterBUMinAggregateOutputType | null
    _max: MasterBUMaxAggregateOutputType | null
  }

  type GetMasterBUGroupByPayload<T extends MasterBUGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MasterBUGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MasterBUGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MasterBUGroupByOutputType[P]>
            : GetScalarType<T[P], MasterBUGroupByOutputType[P]>
        }
      >
    >


  export type MasterBUSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    isActive?: boolean
  }, ExtArgs["result"]["masterBU"]>

  export type MasterBUSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    isActive?: boolean
  }, ExtArgs["result"]["masterBU"]>

  export type MasterBUSelectScalar = {
    id?: boolean
    name?: boolean
    isActive?: boolean
  }


  export type $MasterBUPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "MasterBU"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      isActive: boolean
    }, ExtArgs["result"]["masterBU"]>
    composites: {}
  }

  type MasterBUGetPayload<S extends boolean | null | undefined | MasterBUDefaultArgs> = $Result.GetResult<Prisma.$MasterBUPayload, S>

  type MasterBUCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<MasterBUFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: MasterBUCountAggregateInputType | true
    }

  export interface MasterBUDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MasterBU'], meta: { name: 'MasterBU' } }
    /**
     * Find zero or one MasterBU that matches the filter.
     * @param {MasterBUFindUniqueArgs} args - Arguments to find a MasterBU
     * @example
     * // Get one MasterBU
     * const masterBU = await prisma.masterBU.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MasterBUFindUniqueArgs>(args: SelectSubset<T, MasterBUFindUniqueArgs<ExtArgs>>): Prisma__MasterBUClient<$Result.GetResult<Prisma.$MasterBUPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one MasterBU that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {MasterBUFindUniqueOrThrowArgs} args - Arguments to find a MasterBU
     * @example
     * // Get one MasterBU
     * const masterBU = await prisma.masterBU.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MasterBUFindUniqueOrThrowArgs>(args: SelectSubset<T, MasterBUFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MasterBUClient<$Result.GetResult<Prisma.$MasterBUPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first MasterBU that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterBUFindFirstArgs} args - Arguments to find a MasterBU
     * @example
     * // Get one MasterBU
     * const masterBU = await prisma.masterBU.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MasterBUFindFirstArgs>(args?: SelectSubset<T, MasterBUFindFirstArgs<ExtArgs>>): Prisma__MasterBUClient<$Result.GetResult<Prisma.$MasterBUPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first MasterBU that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterBUFindFirstOrThrowArgs} args - Arguments to find a MasterBU
     * @example
     * // Get one MasterBU
     * const masterBU = await prisma.masterBU.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MasterBUFindFirstOrThrowArgs>(args?: SelectSubset<T, MasterBUFindFirstOrThrowArgs<ExtArgs>>): Prisma__MasterBUClient<$Result.GetResult<Prisma.$MasterBUPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more MasterBUS that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterBUFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MasterBUS
     * const masterBUS = await prisma.masterBU.findMany()
     * 
     * // Get first 10 MasterBUS
     * const masterBUS = await prisma.masterBU.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const masterBUWithIdOnly = await prisma.masterBU.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MasterBUFindManyArgs>(args?: SelectSubset<T, MasterBUFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MasterBUPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a MasterBU.
     * @param {MasterBUCreateArgs} args - Arguments to create a MasterBU.
     * @example
     * // Create one MasterBU
     * const MasterBU = await prisma.masterBU.create({
     *   data: {
     *     // ... data to create a MasterBU
     *   }
     * })
     * 
     */
    create<T extends MasterBUCreateArgs>(args: SelectSubset<T, MasterBUCreateArgs<ExtArgs>>): Prisma__MasterBUClient<$Result.GetResult<Prisma.$MasterBUPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many MasterBUS.
     * @param {MasterBUCreateManyArgs} args - Arguments to create many MasterBUS.
     * @example
     * // Create many MasterBUS
     * const masterBU = await prisma.masterBU.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MasterBUCreateManyArgs>(args?: SelectSubset<T, MasterBUCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many MasterBUS and returns the data saved in the database.
     * @param {MasterBUCreateManyAndReturnArgs} args - Arguments to create many MasterBUS.
     * @example
     * // Create many MasterBUS
     * const masterBU = await prisma.masterBU.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many MasterBUS and only return the `id`
     * const masterBUWithIdOnly = await prisma.masterBU.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MasterBUCreateManyAndReturnArgs>(args?: SelectSubset<T, MasterBUCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MasterBUPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a MasterBU.
     * @param {MasterBUDeleteArgs} args - Arguments to delete one MasterBU.
     * @example
     * // Delete one MasterBU
     * const MasterBU = await prisma.masterBU.delete({
     *   where: {
     *     // ... filter to delete one MasterBU
     *   }
     * })
     * 
     */
    delete<T extends MasterBUDeleteArgs>(args: SelectSubset<T, MasterBUDeleteArgs<ExtArgs>>): Prisma__MasterBUClient<$Result.GetResult<Prisma.$MasterBUPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one MasterBU.
     * @param {MasterBUUpdateArgs} args - Arguments to update one MasterBU.
     * @example
     * // Update one MasterBU
     * const masterBU = await prisma.masterBU.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MasterBUUpdateArgs>(args: SelectSubset<T, MasterBUUpdateArgs<ExtArgs>>): Prisma__MasterBUClient<$Result.GetResult<Prisma.$MasterBUPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more MasterBUS.
     * @param {MasterBUDeleteManyArgs} args - Arguments to filter MasterBUS to delete.
     * @example
     * // Delete a few MasterBUS
     * const { count } = await prisma.masterBU.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MasterBUDeleteManyArgs>(args?: SelectSubset<T, MasterBUDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MasterBUS.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterBUUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MasterBUS
     * const masterBU = await prisma.masterBU.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MasterBUUpdateManyArgs>(args: SelectSubset<T, MasterBUUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one MasterBU.
     * @param {MasterBUUpsertArgs} args - Arguments to update or create a MasterBU.
     * @example
     * // Update or create a MasterBU
     * const masterBU = await prisma.masterBU.upsert({
     *   create: {
     *     // ... data to create a MasterBU
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MasterBU we want to update
     *   }
     * })
     */
    upsert<T extends MasterBUUpsertArgs>(args: SelectSubset<T, MasterBUUpsertArgs<ExtArgs>>): Prisma__MasterBUClient<$Result.GetResult<Prisma.$MasterBUPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of MasterBUS.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterBUCountArgs} args - Arguments to filter MasterBUS to count.
     * @example
     * // Count the number of MasterBUS
     * const count = await prisma.masterBU.count({
     *   where: {
     *     // ... the filter for the MasterBUS we want to count
     *   }
     * })
    **/
    count<T extends MasterBUCountArgs>(
      args?: Subset<T, MasterBUCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MasterBUCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MasterBU.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterBUAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MasterBUAggregateArgs>(args: Subset<T, MasterBUAggregateArgs>): Prisma.PrismaPromise<GetMasterBUAggregateType<T>>

    /**
     * Group by MasterBU.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterBUGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MasterBUGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MasterBUGroupByArgs['orderBy'] }
        : { orderBy?: MasterBUGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MasterBUGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMasterBUGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MasterBU model
   */
  readonly fields: MasterBUFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MasterBU.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MasterBUClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the MasterBU model
   */ 
  interface MasterBUFieldRefs {
    readonly id: FieldRef<"MasterBU", 'String'>
    readonly name: FieldRef<"MasterBU", 'String'>
    readonly isActive: FieldRef<"MasterBU", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * MasterBU findUnique
   */
  export type MasterBUFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBU
     */
    select?: MasterBUSelect<ExtArgs> | null
    /**
     * Filter, which MasterBU to fetch.
     */
    where: MasterBUWhereUniqueInput
  }

  /**
   * MasterBU findUniqueOrThrow
   */
  export type MasterBUFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBU
     */
    select?: MasterBUSelect<ExtArgs> | null
    /**
     * Filter, which MasterBU to fetch.
     */
    where: MasterBUWhereUniqueInput
  }

  /**
   * MasterBU findFirst
   */
  export type MasterBUFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBU
     */
    select?: MasterBUSelect<ExtArgs> | null
    /**
     * Filter, which MasterBU to fetch.
     */
    where?: MasterBUWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterBUS to fetch.
     */
    orderBy?: MasterBUOrderByWithRelationInput | MasterBUOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MasterBUS.
     */
    cursor?: MasterBUWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterBUS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterBUS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MasterBUS.
     */
    distinct?: MasterBUScalarFieldEnum | MasterBUScalarFieldEnum[]
  }

  /**
   * MasterBU findFirstOrThrow
   */
  export type MasterBUFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBU
     */
    select?: MasterBUSelect<ExtArgs> | null
    /**
     * Filter, which MasterBU to fetch.
     */
    where?: MasterBUWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterBUS to fetch.
     */
    orderBy?: MasterBUOrderByWithRelationInput | MasterBUOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MasterBUS.
     */
    cursor?: MasterBUWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterBUS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterBUS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MasterBUS.
     */
    distinct?: MasterBUScalarFieldEnum | MasterBUScalarFieldEnum[]
  }

  /**
   * MasterBU findMany
   */
  export type MasterBUFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBU
     */
    select?: MasterBUSelect<ExtArgs> | null
    /**
     * Filter, which MasterBUS to fetch.
     */
    where?: MasterBUWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterBUS to fetch.
     */
    orderBy?: MasterBUOrderByWithRelationInput | MasterBUOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MasterBUS.
     */
    cursor?: MasterBUWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterBUS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterBUS.
     */
    skip?: number
    distinct?: MasterBUScalarFieldEnum | MasterBUScalarFieldEnum[]
  }

  /**
   * MasterBU create
   */
  export type MasterBUCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBU
     */
    select?: MasterBUSelect<ExtArgs> | null
    /**
     * The data needed to create a MasterBU.
     */
    data: XOR<MasterBUCreateInput, MasterBUUncheckedCreateInput>
  }

  /**
   * MasterBU createMany
   */
  export type MasterBUCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MasterBUS.
     */
    data: MasterBUCreateManyInput | MasterBUCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MasterBU createManyAndReturn
   */
  export type MasterBUCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBU
     */
    select?: MasterBUSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many MasterBUS.
     */
    data: MasterBUCreateManyInput | MasterBUCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MasterBU update
   */
  export type MasterBUUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBU
     */
    select?: MasterBUSelect<ExtArgs> | null
    /**
     * The data needed to update a MasterBU.
     */
    data: XOR<MasterBUUpdateInput, MasterBUUncheckedUpdateInput>
    /**
     * Choose, which MasterBU to update.
     */
    where: MasterBUWhereUniqueInput
  }

  /**
   * MasterBU updateMany
   */
  export type MasterBUUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MasterBUS.
     */
    data: XOR<MasterBUUpdateManyMutationInput, MasterBUUncheckedUpdateManyInput>
    /**
     * Filter which MasterBUS to update
     */
    where?: MasterBUWhereInput
  }

  /**
   * MasterBU upsert
   */
  export type MasterBUUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBU
     */
    select?: MasterBUSelect<ExtArgs> | null
    /**
     * The filter to search for the MasterBU to update in case it exists.
     */
    where: MasterBUWhereUniqueInput
    /**
     * In case the MasterBU found by the `where` argument doesn't exist, create a new MasterBU with this data.
     */
    create: XOR<MasterBUCreateInput, MasterBUUncheckedCreateInput>
    /**
     * In case the MasterBU was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MasterBUUpdateInput, MasterBUUncheckedUpdateInput>
  }

  /**
   * MasterBU delete
   */
  export type MasterBUDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBU
     */
    select?: MasterBUSelect<ExtArgs> | null
    /**
     * Filter which MasterBU to delete.
     */
    where: MasterBUWhereUniqueInput
  }

  /**
   * MasterBU deleteMany
   */
  export type MasterBUDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MasterBUS to delete
     */
    where?: MasterBUWhereInput
  }

  /**
   * MasterBU without action
   */
  export type MasterBUDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterBU
     */
    select?: MasterBUSelect<ExtArgs> | null
  }


  /**
   * Model MasterDescription
   */

  export type AggregateMasterDescription = {
    _count: MasterDescriptionCountAggregateOutputType | null
    _avg: MasterDescriptionAvgAggregateOutputType | null
    _sum: MasterDescriptionSumAggregateOutputType | null
    _min: MasterDescriptionMinAggregateOutputType | null
    _max: MasterDescriptionMaxAggregateOutputType | null
  }

  export type MasterDescriptionAvgAggregateOutputType = {
    weightPerUnit: number | null
  }

  export type MasterDescriptionSumAggregateOutputType = {
    weightPerUnit: number | null
  }

  export type MasterDescriptionMinAggregateOutputType = {
    id: string | null
    name: string | null
    weightPerUnit: number | null
    isActive: boolean | null
  }

  export type MasterDescriptionMaxAggregateOutputType = {
    id: string | null
    name: string | null
    weightPerUnit: number | null
    isActive: boolean | null
  }

  export type MasterDescriptionCountAggregateOutputType = {
    id: number
    name: number
    weightPerUnit: number
    isActive: number
    _all: number
  }


  export type MasterDescriptionAvgAggregateInputType = {
    weightPerUnit?: true
  }

  export type MasterDescriptionSumAggregateInputType = {
    weightPerUnit?: true
  }

  export type MasterDescriptionMinAggregateInputType = {
    id?: true
    name?: true
    weightPerUnit?: true
    isActive?: true
  }

  export type MasterDescriptionMaxAggregateInputType = {
    id?: true
    name?: true
    weightPerUnit?: true
    isActive?: true
  }

  export type MasterDescriptionCountAggregateInputType = {
    id?: true
    name?: true
    weightPerUnit?: true
    isActive?: true
    _all?: true
  }

  export type MasterDescriptionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MasterDescription to aggregate.
     */
    where?: MasterDescriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterDescriptions to fetch.
     */
    orderBy?: MasterDescriptionOrderByWithRelationInput | MasterDescriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MasterDescriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterDescriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterDescriptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MasterDescriptions
    **/
    _count?: true | MasterDescriptionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: MasterDescriptionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: MasterDescriptionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MasterDescriptionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MasterDescriptionMaxAggregateInputType
  }

  export type GetMasterDescriptionAggregateType<T extends MasterDescriptionAggregateArgs> = {
        [P in keyof T & keyof AggregateMasterDescription]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMasterDescription[P]>
      : GetScalarType<T[P], AggregateMasterDescription[P]>
  }




  export type MasterDescriptionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MasterDescriptionWhereInput
    orderBy?: MasterDescriptionOrderByWithAggregationInput | MasterDescriptionOrderByWithAggregationInput[]
    by: MasterDescriptionScalarFieldEnum[] | MasterDescriptionScalarFieldEnum
    having?: MasterDescriptionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MasterDescriptionCountAggregateInputType | true
    _avg?: MasterDescriptionAvgAggregateInputType
    _sum?: MasterDescriptionSumAggregateInputType
    _min?: MasterDescriptionMinAggregateInputType
    _max?: MasterDescriptionMaxAggregateInputType
  }

  export type MasterDescriptionGroupByOutputType = {
    id: string
    name: string
    weightPerUnit: number
    isActive: boolean
    _count: MasterDescriptionCountAggregateOutputType | null
    _avg: MasterDescriptionAvgAggregateOutputType | null
    _sum: MasterDescriptionSumAggregateOutputType | null
    _min: MasterDescriptionMinAggregateOutputType | null
    _max: MasterDescriptionMaxAggregateOutputType | null
  }

  type GetMasterDescriptionGroupByPayload<T extends MasterDescriptionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MasterDescriptionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MasterDescriptionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MasterDescriptionGroupByOutputType[P]>
            : GetScalarType<T[P], MasterDescriptionGroupByOutputType[P]>
        }
      >
    >


  export type MasterDescriptionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    weightPerUnit?: boolean
    isActive?: boolean
  }, ExtArgs["result"]["masterDescription"]>

  export type MasterDescriptionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    weightPerUnit?: boolean
    isActive?: boolean
  }, ExtArgs["result"]["masterDescription"]>

  export type MasterDescriptionSelectScalar = {
    id?: boolean
    name?: boolean
    weightPerUnit?: boolean
    isActive?: boolean
  }


  export type $MasterDescriptionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "MasterDescription"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      weightPerUnit: number
      isActive: boolean
    }, ExtArgs["result"]["masterDescription"]>
    composites: {}
  }

  type MasterDescriptionGetPayload<S extends boolean | null | undefined | MasterDescriptionDefaultArgs> = $Result.GetResult<Prisma.$MasterDescriptionPayload, S>

  type MasterDescriptionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<MasterDescriptionFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: MasterDescriptionCountAggregateInputType | true
    }

  export interface MasterDescriptionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MasterDescription'], meta: { name: 'MasterDescription' } }
    /**
     * Find zero or one MasterDescription that matches the filter.
     * @param {MasterDescriptionFindUniqueArgs} args - Arguments to find a MasterDescription
     * @example
     * // Get one MasterDescription
     * const masterDescription = await prisma.masterDescription.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MasterDescriptionFindUniqueArgs>(args: SelectSubset<T, MasterDescriptionFindUniqueArgs<ExtArgs>>): Prisma__MasterDescriptionClient<$Result.GetResult<Prisma.$MasterDescriptionPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one MasterDescription that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {MasterDescriptionFindUniqueOrThrowArgs} args - Arguments to find a MasterDescription
     * @example
     * // Get one MasterDescription
     * const masterDescription = await prisma.masterDescription.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MasterDescriptionFindUniqueOrThrowArgs>(args: SelectSubset<T, MasterDescriptionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MasterDescriptionClient<$Result.GetResult<Prisma.$MasterDescriptionPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first MasterDescription that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterDescriptionFindFirstArgs} args - Arguments to find a MasterDescription
     * @example
     * // Get one MasterDescription
     * const masterDescription = await prisma.masterDescription.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MasterDescriptionFindFirstArgs>(args?: SelectSubset<T, MasterDescriptionFindFirstArgs<ExtArgs>>): Prisma__MasterDescriptionClient<$Result.GetResult<Prisma.$MasterDescriptionPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first MasterDescription that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterDescriptionFindFirstOrThrowArgs} args - Arguments to find a MasterDescription
     * @example
     * // Get one MasterDescription
     * const masterDescription = await prisma.masterDescription.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MasterDescriptionFindFirstOrThrowArgs>(args?: SelectSubset<T, MasterDescriptionFindFirstOrThrowArgs<ExtArgs>>): Prisma__MasterDescriptionClient<$Result.GetResult<Prisma.$MasterDescriptionPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more MasterDescriptions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterDescriptionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MasterDescriptions
     * const masterDescriptions = await prisma.masterDescription.findMany()
     * 
     * // Get first 10 MasterDescriptions
     * const masterDescriptions = await prisma.masterDescription.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const masterDescriptionWithIdOnly = await prisma.masterDescription.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MasterDescriptionFindManyArgs>(args?: SelectSubset<T, MasterDescriptionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MasterDescriptionPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a MasterDescription.
     * @param {MasterDescriptionCreateArgs} args - Arguments to create a MasterDescription.
     * @example
     * // Create one MasterDescription
     * const MasterDescription = await prisma.masterDescription.create({
     *   data: {
     *     // ... data to create a MasterDescription
     *   }
     * })
     * 
     */
    create<T extends MasterDescriptionCreateArgs>(args: SelectSubset<T, MasterDescriptionCreateArgs<ExtArgs>>): Prisma__MasterDescriptionClient<$Result.GetResult<Prisma.$MasterDescriptionPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many MasterDescriptions.
     * @param {MasterDescriptionCreateManyArgs} args - Arguments to create many MasterDescriptions.
     * @example
     * // Create many MasterDescriptions
     * const masterDescription = await prisma.masterDescription.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MasterDescriptionCreateManyArgs>(args?: SelectSubset<T, MasterDescriptionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many MasterDescriptions and returns the data saved in the database.
     * @param {MasterDescriptionCreateManyAndReturnArgs} args - Arguments to create many MasterDescriptions.
     * @example
     * // Create many MasterDescriptions
     * const masterDescription = await prisma.masterDescription.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many MasterDescriptions and only return the `id`
     * const masterDescriptionWithIdOnly = await prisma.masterDescription.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MasterDescriptionCreateManyAndReturnArgs>(args?: SelectSubset<T, MasterDescriptionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MasterDescriptionPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a MasterDescription.
     * @param {MasterDescriptionDeleteArgs} args - Arguments to delete one MasterDescription.
     * @example
     * // Delete one MasterDescription
     * const MasterDescription = await prisma.masterDescription.delete({
     *   where: {
     *     // ... filter to delete one MasterDescription
     *   }
     * })
     * 
     */
    delete<T extends MasterDescriptionDeleteArgs>(args: SelectSubset<T, MasterDescriptionDeleteArgs<ExtArgs>>): Prisma__MasterDescriptionClient<$Result.GetResult<Prisma.$MasterDescriptionPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one MasterDescription.
     * @param {MasterDescriptionUpdateArgs} args - Arguments to update one MasterDescription.
     * @example
     * // Update one MasterDescription
     * const masterDescription = await prisma.masterDescription.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MasterDescriptionUpdateArgs>(args: SelectSubset<T, MasterDescriptionUpdateArgs<ExtArgs>>): Prisma__MasterDescriptionClient<$Result.GetResult<Prisma.$MasterDescriptionPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more MasterDescriptions.
     * @param {MasterDescriptionDeleteManyArgs} args - Arguments to filter MasterDescriptions to delete.
     * @example
     * // Delete a few MasterDescriptions
     * const { count } = await prisma.masterDescription.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MasterDescriptionDeleteManyArgs>(args?: SelectSubset<T, MasterDescriptionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MasterDescriptions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterDescriptionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MasterDescriptions
     * const masterDescription = await prisma.masterDescription.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MasterDescriptionUpdateManyArgs>(args: SelectSubset<T, MasterDescriptionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one MasterDescription.
     * @param {MasterDescriptionUpsertArgs} args - Arguments to update or create a MasterDescription.
     * @example
     * // Update or create a MasterDescription
     * const masterDescription = await prisma.masterDescription.upsert({
     *   create: {
     *     // ... data to create a MasterDescription
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MasterDescription we want to update
     *   }
     * })
     */
    upsert<T extends MasterDescriptionUpsertArgs>(args: SelectSubset<T, MasterDescriptionUpsertArgs<ExtArgs>>): Prisma__MasterDescriptionClient<$Result.GetResult<Prisma.$MasterDescriptionPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of MasterDescriptions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterDescriptionCountArgs} args - Arguments to filter MasterDescriptions to count.
     * @example
     * // Count the number of MasterDescriptions
     * const count = await prisma.masterDescription.count({
     *   where: {
     *     // ... the filter for the MasterDescriptions we want to count
     *   }
     * })
    **/
    count<T extends MasterDescriptionCountArgs>(
      args?: Subset<T, MasterDescriptionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MasterDescriptionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MasterDescription.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterDescriptionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MasterDescriptionAggregateArgs>(args: Subset<T, MasterDescriptionAggregateArgs>): Prisma.PrismaPromise<GetMasterDescriptionAggregateType<T>>

    /**
     * Group by MasterDescription.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterDescriptionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MasterDescriptionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MasterDescriptionGroupByArgs['orderBy'] }
        : { orderBy?: MasterDescriptionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MasterDescriptionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMasterDescriptionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MasterDescription model
   */
  readonly fields: MasterDescriptionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MasterDescription.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MasterDescriptionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the MasterDescription model
   */ 
  interface MasterDescriptionFieldRefs {
    readonly id: FieldRef<"MasterDescription", 'String'>
    readonly name: FieldRef<"MasterDescription", 'String'>
    readonly weightPerUnit: FieldRef<"MasterDescription", 'Float'>
    readonly isActive: FieldRef<"MasterDescription", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * MasterDescription findUnique
   */
  export type MasterDescriptionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterDescription
     */
    select?: MasterDescriptionSelect<ExtArgs> | null
    /**
     * Filter, which MasterDescription to fetch.
     */
    where: MasterDescriptionWhereUniqueInput
  }

  /**
   * MasterDescription findUniqueOrThrow
   */
  export type MasterDescriptionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterDescription
     */
    select?: MasterDescriptionSelect<ExtArgs> | null
    /**
     * Filter, which MasterDescription to fetch.
     */
    where: MasterDescriptionWhereUniqueInput
  }

  /**
   * MasterDescription findFirst
   */
  export type MasterDescriptionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterDescription
     */
    select?: MasterDescriptionSelect<ExtArgs> | null
    /**
     * Filter, which MasterDescription to fetch.
     */
    where?: MasterDescriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterDescriptions to fetch.
     */
    orderBy?: MasterDescriptionOrderByWithRelationInput | MasterDescriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MasterDescriptions.
     */
    cursor?: MasterDescriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterDescriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterDescriptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MasterDescriptions.
     */
    distinct?: MasterDescriptionScalarFieldEnum | MasterDescriptionScalarFieldEnum[]
  }

  /**
   * MasterDescription findFirstOrThrow
   */
  export type MasterDescriptionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterDescription
     */
    select?: MasterDescriptionSelect<ExtArgs> | null
    /**
     * Filter, which MasterDescription to fetch.
     */
    where?: MasterDescriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterDescriptions to fetch.
     */
    orderBy?: MasterDescriptionOrderByWithRelationInput | MasterDescriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MasterDescriptions.
     */
    cursor?: MasterDescriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterDescriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterDescriptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MasterDescriptions.
     */
    distinct?: MasterDescriptionScalarFieldEnum | MasterDescriptionScalarFieldEnum[]
  }

  /**
   * MasterDescription findMany
   */
  export type MasterDescriptionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterDescription
     */
    select?: MasterDescriptionSelect<ExtArgs> | null
    /**
     * Filter, which MasterDescriptions to fetch.
     */
    where?: MasterDescriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterDescriptions to fetch.
     */
    orderBy?: MasterDescriptionOrderByWithRelationInput | MasterDescriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MasterDescriptions.
     */
    cursor?: MasterDescriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterDescriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterDescriptions.
     */
    skip?: number
    distinct?: MasterDescriptionScalarFieldEnum | MasterDescriptionScalarFieldEnum[]
  }

  /**
   * MasterDescription create
   */
  export type MasterDescriptionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterDescription
     */
    select?: MasterDescriptionSelect<ExtArgs> | null
    /**
     * The data needed to create a MasterDescription.
     */
    data: XOR<MasterDescriptionCreateInput, MasterDescriptionUncheckedCreateInput>
  }

  /**
   * MasterDescription createMany
   */
  export type MasterDescriptionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MasterDescriptions.
     */
    data: MasterDescriptionCreateManyInput | MasterDescriptionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MasterDescription createManyAndReturn
   */
  export type MasterDescriptionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterDescription
     */
    select?: MasterDescriptionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many MasterDescriptions.
     */
    data: MasterDescriptionCreateManyInput | MasterDescriptionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MasterDescription update
   */
  export type MasterDescriptionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterDescription
     */
    select?: MasterDescriptionSelect<ExtArgs> | null
    /**
     * The data needed to update a MasterDescription.
     */
    data: XOR<MasterDescriptionUpdateInput, MasterDescriptionUncheckedUpdateInput>
    /**
     * Choose, which MasterDescription to update.
     */
    where: MasterDescriptionWhereUniqueInput
  }

  /**
   * MasterDescription updateMany
   */
  export type MasterDescriptionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MasterDescriptions.
     */
    data: XOR<MasterDescriptionUpdateManyMutationInput, MasterDescriptionUncheckedUpdateManyInput>
    /**
     * Filter which MasterDescriptions to update
     */
    where?: MasterDescriptionWhereInput
  }

  /**
   * MasterDescription upsert
   */
  export type MasterDescriptionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterDescription
     */
    select?: MasterDescriptionSelect<ExtArgs> | null
    /**
     * The filter to search for the MasterDescription to update in case it exists.
     */
    where: MasterDescriptionWhereUniqueInput
    /**
     * In case the MasterDescription found by the `where` argument doesn't exist, create a new MasterDescription with this data.
     */
    create: XOR<MasterDescriptionCreateInput, MasterDescriptionUncheckedCreateInput>
    /**
     * In case the MasterDescription was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MasterDescriptionUpdateInput, MasterDescriptionUncheckedUpdateInput>
  }

  /**
   * MasterDescription delete
   */
  export type MasterDescriptionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterDescription
     */
    select?: MasterDescriptionSelect<ExtArgs> | null
    /**
     * Filter which MasterDescription to delete.
     */
    where: MasterDescriptionWhereUniqueInput
  }

  /**
   * MasterDescription deleteMany
   */
  export type MasterDescriptionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MasterDescriptions to delete
     */
    where?: MasterDescriptionWhereInput
  }

  /**
   * MasterDescription without action
   */
  export type MasterDescriptionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterDescription
     */
    select?: MasterDescriptionSelect<ExtArgs> | null
  }


  /**
   * Model MasterGMTType
   */

  export type AggregateMasterGMTType = {
    _count: MasterGMTTypeCountAggregateOutputType | null
    _min: MasterGMTTypeMinAggregateOutputType | null
    _max: MasterGMTTypeMaxAggregateOutputType | null
  }

  export type MasterGMTTypeMinAggregateOutputType = {
    id: string | null
    name: string | null
    isActive: boolean | null
  }

  export type MasterGMTTypeMaxAggregateOutputType = {
    id: string | null
    name: string | null
    isActive: boolean | null
  }

  export type MasterGMTTypeCountAggregateOutputType = {
    id: number
    name: number
    isActive: number
    _all: number
  }


  export type MasterGMTTypeMinAggregateInputType = {
    id?: true
    name?: true
    isActive?: true
  }

  export type MasterGMTTypeMaxAggregateInputType = {
    id?: true
    name?: true
    isActive?: true
  }

  export type MasterGMTTypeCountAggregateInputType = {
    id?: true
    name?: true
    isActive?: true
    _all?: true
  }

  export type MasterGMTTypeAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MasterGMTType to aggregate.
     */
    where?: MasterGMTTypeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterGMTTypes to fetch.
     */
    orderBy?: MasterGMTTypeOrderByWithRelationInput | MasterGMTTypeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MasterGMTTypeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterGMTTypes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterGMTTypes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MasterGMTTypes
    **/
    _count?: true | MasterGMTTypeCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MasterGMTTypeMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MasterGMTTypeMaxAggregateInputType
  }

  export type GetMasterGMTTypeAggregateType<T extends MasterGMTTypeAggregateArgs> = {
        [P in keyof T & keyof AggregateMasterGMTType]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMasterGMTType[P]>
      : GetScalarType<T[P], AggregateMasterGMTType[P]>
  }




  export type MasterGMTTypeGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MasterGMTTypeWhereInput
    orderBy?: MasterGMTTypeOrderByWithAggregationInput | MasterGMTTypeOrderByWithAggregationInput[]
    by: MasterGMTTypeScalarFieldEnum[] | MasterGMTTypeScalarFieldEnum
    having?: MasterGMTTypeScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MasterGMTTypeCountAggregateInputType | true
    _min?: MasterGMTTypeMinAggregateInputType
    _max?: MasterGMTTypeMaxAggregateInputType
  }

  export type MasterGMTTypeGroupByOutputType = {
    id: string
    name: string
    isActive: boolean
    _count: MasterGMTTypeCountAggregateOutputType | null
    _min: MasterGMTTypeMinAggregateOutputType | null
    _max: MasterGMTTypeMaxAggregateOutputType | null
  }

  type GetMasterGMTTypeGroupByPayload<T extends MasterGMTTypeGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MasterGMTTypeGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MasterGMTTypeGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MasterGMTTypeGroupByOutputType[P]>
            : GetScalarType<T[P], MasterGMTTypeGroupByOutputType[P]>
        }
      >
    >


  export type MasterGMTTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    isActive?: boolean
  }, ExtArgs["result"]["masterGMTType"]>

  export type MasterGMTTypeSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    isActive?: boolean
  }, ExtArgs["result"]["masterGMTType"]>

  export type MasterGMTTypeSelectScalar = {
    id?: boolean
    name?: boolean
    isActive?: boolean
  }


  export type $MasterGMTTypePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "MasterGMTType"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      isActive: boolean
    }, ExtArgs["result"]["masterGMTType"]>
    composites: {}
  }

  type MasterGMTTypeGetPayload<S extends boolean | null | undefined | MasterGMTTypeDefaultArgs> = $Result.GetResult<Prisma.$MasterGMTTypePayload, S>

  type MasterGMTTypeCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<MasterGMTTypeFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: MasterGMTTypeCountAggregateInputType | true
    }

  export interface MasterGMTTypeDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MasterGMTType'], meta: { name: 'MasterGMTType' } }
    /**
     * Find zero or one MasterGMTType that matches the filter.
     * @param {MasterGMTTypeFindUniqueArgs} args - Arguments to find a MasterGMTType
     * @example
     * // Get one MasterGMTType
     * const masterGMTType = await prisma.masterGMTType.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MasterGMTTypeFindUniqueArgs>(args: SelectSubset<T, MasterGMTTypeFindUniqueArgs<ExtArgs>>): Prisma__MasterGMTTypeClient<$Result.GetResult<Prisma.$MasterGMTTypePayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one MasterGMTType that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {MasterGMTTypeFindUniqueOrThrowArgs} args - Arguments to find a MasterGMTType
     * @example
     * // Get one MasterGMTType
     * const masterGMTType = await prisma.masterGMTType.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MasterGMTTypeFindUniqueOrThrowArgs>(args: SelectSubset<T, MasterGMTTypeFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MasterGMTTypeClient<$Result.GetResult<Prisma.$MasterGMTTypePayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first MasterGMTType that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterGMTTypeFindFirstArgs} args - Arguments to find a MasterGMTType
     * @example
     * // Get one MasterGMTType
     * const masterGMTType = await prisma.masterGMTType.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MasterGMTTypeFindFirstArgs>(args?: SelectSubset<T, MasterGMTTypeFindFirstArgs<ExtArgs>>): Prisma__MasterGMTTypeClient<$Result.GetResult<Prisma.$MasterGMTTypePayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first MasterGMTType that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterGMTTypeFindFirstOrThrowArgs} args - Arguments to find a MasterGMTType
     * @example
     * // Get one MasterGMTType
     * const masterGMTType = await prisma.masterGMTType.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MasterGMTTypeFindFirstOrThrowArgs>(args?: SelectSubset<T, MasterGMTTypeFindFirstOrThrowArgs<ExtArgs>>): Prisma__MasterGMTTypeClient<$Result.GetResult<Prisma.$MasterGMTTypePayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more MasterGMTTypes that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterGMTTypeFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MasterGMTTypes
     * const masterGMTTypes = await prisma.masterGMTType.findMany()
     * 
     * // Get first 10 MasterGMTTypes
     * const masterGMTTypes = await prisma.masterGMTType.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const masterGMTTypeWithIdOnly = await prisma.masterGMTType.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MasterGMTTypeFindManyArgs>(args?: SelectSubset<T, MasterGMTTypeFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MasterGMTTypePayload<ExtArgs>, T, "findMany">>

    /**
     * Create a MasterGMTType.
     * @param {MasterGMTTypeCreateArgs} args - Arguments to create a MasterGMTType.
     * @example
     * // Create one MasterGMTType
     * const MasterGMTType = await prisma.masterGMTType.create({
     *   data: {
     *     // ... data to create a MasterGMTType
     *   }
     * })
     * 
     */
    create<T extends MasterGMTTypeCreateArgs>(args: SelectSubset<T, MasterGMTTypeCreateArgs<ExtArgs>>): Prisma__MasterGMTTypeClient<$Result.GetResult<Prisma.$MasterGMTTypePayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many MasterGMTTypes.
     * @param {MasterGMTTypeCreateManyArgs} args - Arguments to create many MasterGMTTypes.
     * @example
     * // Create many MasterGMTTypes
     * const masterGMTType = await prisma.masterGMTType.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MasterGMTTypeCreateManyArgs>(args?: SelectSubset<T, MasterGMTTypeCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many MasterGMTTypes and returns the data saved in the database.
     * @param {MasterGMTTypeCreateManyAndReturnArgs} args - Arguments to create many MasterGMTTypes.
     * @example
     * // Create many MasterGMTTypes
     * const masterGMTType = await prisma.masterGMTType.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many MasterGMTTypes and only return the `id`
     * const masterGMTTypeWithIdOnly = await prisma.masterGMTType.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MasterGMTTypeCreateManyAndReturnArgs>(args?: SelectSubset<T, MasterGMTTypeCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MasterGMTTypePayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a MasterGMTType.
     * @param {MasterGMTTypeDeleteArgs} args - Arguments to delete one MasterGMTType.
     * @example
     * // Delete one MasterGMTType
     * const MasterGMTType = await prisma.masterGMTType.delete({
     *   where: {
     *     // ... filter to delete one MasterGMTType
     *   }
     * })
     * 
     */
    delete<T extends MasterGMTTypeDeleteArgs>(args: SelectSubset<T, MasterGMTTypeDeleteArgs<ExtArgs>>): Prisma__MasterGMTTypeClient<$Result.GetResult<Prisma.$MasterGMTTypePayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one MasterGMTType.
     * @param {MasterGMTTypeUpdateArgs} args - Arguments to update one MasterGMTType.
     * @example
     * // Update one MasterGMTType
     * const masterGMTType = await prisma.masterGMTType.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MasterGMTTypeUpdateArgs>(args: SelectSubset<T, MasterGMTTypeUpdateArgs<ExtArgs>>): Prisma__MasterGMTTypeClient<$Result.GetResult<Prisma.$MasterGMTTypePayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more MasterGMTTypes.
     * @param {MasterGMTTypeDeleteManyArgs} args - Arguments to filter MasterGMTTypes to delete.
     * @example
     * // Delete a few MasterGMTTypes
     * const { count } = await prisma.masterGMTType.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MasterGMTTypeDeleteManyArgs>(args?: SelectSubset<T, MasterGMTTypeDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MasterGMTTypes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterGMTTypeUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MasterGMTTypes
     * const masterGMTType = await prisma.masterGMTType.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MasterGMTTypeUpdateManyArgs>(args: SelectSubset<T, MasterGMTTypeUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one MasterGMTType.
     * @param {MasterGMTTypeUpsertArgs} args - Arguments to update or create a MasterGMTType.
     * @example
     * // Update or create a MasterGMTType
     * const masterGMTType = await prisma.masterGMTType.upsert({
     *   create: {
     *     // ... data to create a MasterGMTType
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MasterGMTType we want to update
     *   }
     * })
     */
    upsert<T extends MasterGMTTypeUpsertArgs>(args: SelectSubset<T, MasterGMTTypeUpsertArgs<ExtArgs>>): Prisma__MasterGMTTypeClient<$Result.GetResult<Prisma.$MasterGMTTypePayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of MasterGMTTypes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterGMTTypeCountArgs} args - Arguments to filter MasterGMTTypes to count.
     * @example
     * // Count the number of MasterGMTTypes
     * const count = await prisma.masterGMTType.count({
     *   where: {
     *     // ... the filter for the MasterGMTTypes we want to count
     *   }
     * })
    **/
    count<T extends MasterGMTTypeCountArgs>(
      args?: Subset<T, MasterGMTTypeCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MasterGMTTypeCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MasterGMTType.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterGMTTypeAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MasterGMTTypeAggregateArgs>(args: Subset<T, MasterGMTTypeAggregateArgs>): Prisma.PrismaPromise<GetMasterGMTTypeAggregateType<T>>

    /**
     * Group by MasterGMTType.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterGMTTypeGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MasterGMTTypeGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MasterGMTTypeGroupByArgs['orderBy'] }
        : { orderBy?: MasterGMTTypeGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MasterGMTTypeGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMasterGMTTypeGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MasterGMTType model
   */
  readonly fields: MasterGMTTypeFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MasterGMTType.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MasterGMTTypeClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the MasterGMTType model
   */ 
  interface MasterGMTTypeFieldRefs {
    readonly id: FieldRef<"MasterGMTType", 'String'>
    readonly name: FieldRef<"MasterGMTType", 'String'>
    readonly isActive: FieldRef<"MasterGMTType", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * MasterGMTType findUnique
   */
  export type MasterGMTTypeFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterGMTType
     */
    select?: MasterGMTTypeSelect<ExtArgs> | null
    /**
     * Filter, which MasterGMTType to fetch.
     */
    where: MasterGMTTypeWhereUniqueInput
  }

  /**
   * MasterGMTType findUniqueOrThrow
   */
  export type MasterGMTTypeFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterGMTType
     */
    select?: MasterGMTTypeSelect<ExtArgs> | null
    /**
     * Filter, which MasterGMTType to fetch.
     */
    where: MasterGMTTypeWhereUniqueInput
  }

  /**
   * MasterGMTType findFirst
   */
  export type MasterGMTTypeFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterGMTType
     */
    select?: MasterGMTTypeSelect<ExtArgs> | null
    /**
     * Filter, which MasterGMTType to fetch.
     */
    where?: MasterGMTTypeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterGMTTypes to fetch.
     */
    orderBy?: MasterGMTTypeOrderByWithRelationInput | MasterGMTTypeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MasterGMTTypes.
     */
    cursor?: MasterGMTTypeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterGMTTypes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterGMTTypes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MasterGMTTypes.
     */
    distinct?: MasterGMTTypeScalarFieldEnum | MasterGMTTypeScalarFieldEnum[]
  }

  /**
   * MasterGMTType findFirstOrThrow
   */
  export type MasterGMTTypeFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterGMTType
     */
    select?: MasterGMTTypeSelect<ExtArgs> | null
    /**
     * Filter, which MasterGMTType to fetch.
     */
    where?: MasterGMTTypeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterGMTTypes to fetch.
     */
    orderBy?: MasterGMTTypeOrderByWithRelationInput | MasterGMTTypeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MasterGMTTypes.
     */
    cursor?: MasterGMTTypeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterGMTTypes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterGMTTypes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MasterGMTTypes.
     */
    distinct?: MasterGMTTypeScalarFieldEnum | MasterGMTTypeScalarFieldEnum[]
  }

  /**
   * MasterGMTType findMany
   */
  export type MasterGMTTypeFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterGMTType
     */
    select?: MasterGMTTypeSelect<ExtArgs> | null
    /**
     * Filter, which MasterGMTTypes to fetch.
     */
    where?: MasterGMTTypeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterGMTTypes to fetch.
     */
    orderBy?: MasterGMTTypeOrderByWithRelationInput | MasterGMTTypeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MasterGMTTypes.
     */
    cursor?: MasterGMTTypeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterGMTTypes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterGMTTypes.
     */
    skip?: number
    distinct?: MasterGMTTypeScalarFieldEnum | MasterGMTTypeScalarFieldEnum[]
  }

  /**
   * MasterGMTType create
   */
  export type MasterGMTTypeCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterGMTType
     */
    select?: MasterGMTTypeSelect<ExtArgs> | null
    /**
     * The data needed to create a MasterGMTType.
     */
    data: XOR<MasterGMTTypeCreateInput, MasterGMTTypeUncheckedCreateInput>
  }

  /**
   * MasterGMTType createMany
   */
  export type MasterGMTTypeCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MasterGMTTypes.
     */
    data: MasterGMTTypeCreateManyInput | MasterGMTTypeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MasterGMTType createManyAndReturn
   */
  export type MasterGMTTypeCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterGMTType
     */
    select?: MasterGMTTypeSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many MasterGMTTypes.
     */
    data: MasterGMTTypeCreateManyInput | MasterGMTTypeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MasterGMTType update
   */
  export type MasterGMTTypeUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterGMTType
     */
    select?: MasterGMTTypeSelect<ExtArgs> | null
    /**
     * The data needed to update a MasterGMTType.
     */
    data: XOR<MasterGMTTypeUpdateInput, MasterGMTTypeUncheckedUpdateInput>
    /**
     * Choose, which MasterGMTType to update.
     */
    where: MasterGMTTypeWhereUniqueInput
  }

  /**
   * MasterGMTType updateMany
   */
  export type MasterGMTTypeUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MasterGMTTypes.
     */
    data: XOR<MasterGMTTypeUpdateManyMutationInput, MasterGMTTypeUncheckedUpdateManyInput>
    /**
     * Filter which MasterGMTTypes to update
     */
    where?: MasterGMTTypeWhereInput
  }

  /**
   * MasterGMTType upsert
   */
  export type MasterGMTTypeUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterGMTType
     */
    select?: MasterGMTTypeSelect<ExtArgs> | null
    /**
     * The filter to search for the MasterGMTType to update in case it exists.
     */
    where: MasterGMTTypeWhereUniqueInput
    /**
     * In case the MasterGMTType found by the `where` argument doesn't exist, create a new MasterGMTType with this data.
     */
    create: XOR<MasterGMTTypeCreateInput, MasterGMTTypeUncheckedCreateInput>
    /**
     * In case the MasterGMTType was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MasterGMTTypeUpdateInput, MasterGMTTypeUncheckedUpdateInput>
  }

  /**
   * MasterGMTType delete
   */
  export type MasterGMTTypeDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterGMTType
     */
    select?: MasterGMTTypeSelect<ExtArgs> | null
    /**
     * Filter which MasterGMTType to delete.
     */
    where: MasterGMTTypeWhereUniqueInput
  }

  /**
   * MasterGMTType deleteMany
   */
  export type MasterGMTTypeDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MasterGMTTypes to delete
     */
    where?: MasterGMTTypeWhereInput
  }

  /**
   * MasterGMTType without action
   */
  export type MasterGMTTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterGMTType
     */
    select?: MasterGMTTypeSelect<ExtArgs> | null
  }


  /**
   * Model MasterPort
   */

  export type AggregateMasterPort = {
    _count: MasterPortCountAggregateOutputType | null
    _avg: MasterPortAvgAggregateOutputType | null
    _sum: MasterPortSumAggregateOutputType | null
    _min: MasterPortMinAggregateOutputType | null
    _max: MasterPortMaxAggregateOutputType | null
  }

  export type MasterPortAvgAggregateOutputType = {
    ratePerKg: number | null
  }

  export type MasterPortSumAggregateOutputType = {
    ratePerKg: number | null
  }

  export type MasterPortMinAggregateOutputType = {
    id: string | null
    country: string | null
    port: string | null
    ratePerKg: number | null
    isActive: boolean | null
    updatedAt: Date | null
  }

  export type MasterPortMaxAggregateOutputType = {
    id: string | null
    country: string | null
    port: string | null
    ratePerKg: number | null
    isActive: boolean | null
    updatedAt: Date | null
  }

  export type MasterPortCountAggregateOutputType = {
    id: number
    country: number
    port: number
    ratePerKg: number
    isActive: number
    updatedAt: number
    _all: number
  }


  export type MasterPortAvgAggregateInputType = {
    ratePerKg?: true
  }

  export type MasterPortSumAggregateInputType = {
    ratePerKg?: true
  }

  export type MasterPortMinAggregateInputType = {
    id?: true
    country?: true
    port?: true
    ratePerKg?: true
    isActive?: true
    updatedAt?: true
  }

  export type MasterPortMaxAggregateInputType = {
    id?: true
    country?: true
    port?: true
    ratePerKg?: true
    isActive?: true
    updatedAt?: true
  }

  export type MasterPortCountAggregateInputType = {
    id?: true
    country?: true
    port?: true
    ratePerKg?: true
    isActive?: true
    updatedAt?: true
    _all?: true
  }

  export type MasterPortAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MasterPort to aggregate.
     */
    where?: MasterPortWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterPorts to fetch.
     */
    orderBy?: MasterPortOrderByWithRelationInput | MasterPortOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MasterPortWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterPorts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterPorts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MasterPorts
    **/
    _count?: true | MasterPortCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: MasterPortAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: MasterPortSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MasterPortMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MasterPortMaxAggregateInputType
  }

  export type GetMasterPortAggregateType<T extends MasterPortAggregateArgs> = {
        [P in keyof T & keyof AggregateMasterPort]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMasterPort[P]>
      : GetScalarType<T[P], AggregateMasterPort[P]>
  }




  export type MasterPortGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MasterPortWhereInput
    orderBy?: MasterPortOrderByWithAggregationInput | MasterPortOrderByWithAggregationInput[]
    by: MasterPortScalarFieldEnum[] | MasterPortScalarFieldEnum
    having?: MasterPortScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MasterPortCountAggregateInputType | true
    _avg?: MasterPortAvgAggregateInputType
    _sum?: MasterPortSumAggregateInputType
    _min?: MasterPortMinAggregateInputType
    _max?: MasterPortMaxAggregateInputType
  }

  export type MasterPortGroupByOutputType = {
    id: string
    country: string
    port: string
    ratePerKg: number
    isActive: boolean
    updatedAt: Date
    _count: MasterPortCountAggregateOutputType | null
    _avg: MasterPortAvgAggregateOutputType | null
    _sum: MasterPortSumAggregateOutputType | null
    _min: MasterPortMinAggregateOutputType | null
    _max: MasterPortMaxAggregateOutputType | null
  }

  type GetMasterPortGroupByPayload<T extends MasterPortGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MasterPortGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MasterPortGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MasterPortGroupByOutputType[P]>
            : GetScalarType<T[P], MasterPortGroupByOutputType[P]>
        }
      >
    >


  export type MasterPortSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    country?: boolean
    port?: boolean
    ratePerKg?: boolean
    isActive?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["masterPort"]>

  export type MasterPortSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    country?: boolean
    port?: boolean
    ratePerKg?: boolean
    isActive?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["masterPort"]>

  export type MasterPortSelectScalar = {
    id?: boolean
    country?: boolean
    port?: boolean
    ratePerKg?: boolean
    isActive?: boolean
    updatedAt?: boolean
  }


  export type $MasterPortPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "MasterPort"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      country: string
      port: string
      ratePerKg: number
      isActive: boolean
      updatedAt: Date
    }, ExtArgs["result"]["masterPort"]>
    composites: {}
  }

  type MasterPortGetPayload<S extends boolean | null | undefined | MasterPortDefaultArgs> = $Result.GetResult<Prisma.$MasterPortPayload, S>

  type MasterPortCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<MasterPortFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: MasterPortCountAggregateInputType | true
    }

  export interface MasterPortDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MasterPort'], meta: { name: 'MasterPort' } }
    /**
     * Find zero or one MasterPort that matches the filter.
     * @param {MasterPortFindUniqueArgs} args - Arguments to find a MasterPort
     * @example
     * // Get one MasterPort
     * const masterPort = await prisma.masterPort.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MasterPortFindUniqueArgs>(args: SelectSubset<T, MasterPortFindUniqueArgs<ExtArgs>>): Prisma__MasterPortClient<$Result.GetResult<Prisma.$MasterPortPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one MasterPort that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {MasterPortFindUniqueOrThrowArgs} args - Arguments to find a MasterPort
     * @example
     * // Get one MasterPort
     * const masterPort = await prisma.masterPort.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MasterPortFindUniqueOrThrowArgs>(args: SelectSubset<T, MasterPortFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MasterPortClient<$Result.GetResult<Prisma.$MasterPortPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first MasterPort that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterPortFindFirstArgs} args - Arguments to find a MasterPort
     * @example
     * // Get one MasterPort
     * const masterPort = await prisma.masterPort.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MasterPortFindFirstArgs>(args?: SelectSubset<T, MasterPortFindFirstArgs<ExtArgs>>): Prisma__MasterPortClient<$Result.GetResult<Prisma.$MasterPortPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first MasterPort that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterPortFindFirstOrThrowArgs} args - Arguments to find a MasterPort
     * @example
     * // Get one MasterPort
     * const masterPort = await prisma.masterPort.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MasterPortFindFirstOrThrowArgs>(args?: SelectSubset<T, MasterPortFindFirstOrThrowArgs<ExtArgs>>): Prisma__MasterPortClient<$Result.GetResult<Prisma.$MasterPortPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more MasterPorts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterPortFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MasterPorts
     * const masterPorts = await prisma.masterPort.findMany()
     * 
     * // Get first 10 MasterPorts
     * const masterPorts = await prisma.masterPort.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const masterPortWithIdOnly = await prisma.masterPort.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MasterPortFindManyArgs>(args?: SelectSubset<T, MasterPortFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MasterPortPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a MasterPort.
     * @param {MasterPortCreateArgs} args - Arguments to create a MasterPort.
     * @example
     * // Create one MasterPort
     * const MasterPort = await prisma.masterPort.create({
     *   data: {
     *     // ... data to create a MasterPort
     *   }
     * })
     * 
     */
    create<T extends MasterPortCreateArgs>(args: SelectSubset<T, MasterPortCreateArgs<ExtArgs>>): Prisma__MasterPortClient<$Result.GetResult<Prisma.$MasterPortPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many MasterPorts.
     * @param {MasterPortCreateManyArgs} args - Arguments to create many MasterPorts.
     * @example
     * // Create many MasterPorts
     * const masterPort = await prisma.masterPort.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MasterPortCreateManyArgs>(args?: SelectSubset<T, MasterPortCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many MasterPorts and returns the data saved in the database.
     * @param {MasterPortCreateManyAndReturnArgs} args - Arguments to create many MasterPorts.
     * @example
     * // Create many MasterPorts
     * const masterPort = await prisma.masterPort.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many MasterPorts and only return the `id`
     * const masterPortWithIdOnly = await prisma.masterPort.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MasterPortCreateManyAndReturnArgs>(args?: SelectSubset<T, MasterPortCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MasterPortPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a MasterPort.
     * @param {MasterPortDeleteArgs} args - Arguments to delete one MasterPort.
     * @example
     * // Delete one MasterPort
     * const MasterPort = await prisma.masterPort.delete({
     *   where: {
     *     // ... filter to delete one MasterPort
     *   }
     * })
     * 
     */
    delete<T extends MasterPortDeleteArgs>(args: SelectSubset<T, MasterPortDeleteArgs<ExtArgs>>): Prisma__MasterPortClient<$Result.GetResult<Prisma.$MasterPortPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one MasterPort.
     * @param {MasterPortUpdateArgs} args - Arguments to update one MasterPort.
     * @example
     * // Update one MasterPort
     * const masterPort = await prisma.masterPort.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MasterPortUpdateArgs>(args: SelectSubset<T, MasterPortUpdateArgs<ExtArgs>>): Prisma__MasterPortClient<$Result.GetResult<Prisma.$MasterPortPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more MasterPorts.
     * @param {MasterPortDeleteManyArgs} args - Arguments to filter MasterPorts to delete.
     * @example
     * // Delete a few MasterPorts
     * const { count } = await prisma.masterPort.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MasterPortDeleteManyArgs>(args?: SelectSubset<T, MasterPortDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MasterPorts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterPortUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MasterPorts
     * const masterPort = await prisma.masterPort.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MasterPortUpdateManyArgs>(args: SelectSubset<T, MasterPortUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one MasterPort.
     * @param {MasterPortUpsertArgs} args - Arguments to update or create a MasterPort.
     * @example
     * // Update or create a MasterPort
     * const masterPort = await prisma.masterPort.upsert({
     *   create: {
     *     // ... data to create a MasterPort
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MasterPort we want to update
     *   }
     * })
     */
    upsert<T extends MasterPortUpsertArgs>(args: SelectSubset<T, MasterPortUpsertArgs<ExtArgs>>): Prisma__MasterPortClient<$Result.GetResult<Prisma.$MasterPortPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of MasterPorts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterPortCountArgs} args - Arguments to filter MasterPorts to count.
     * @example
     * // Count the number of MasterPorts
     * const count = await prisma.masterPort.count({
     *   where: {
     *     // ... the filter for the MasterPorts we want to count
     *   }
     * })
    **/
    count<T extends MasterPortCountArgs>(
      args?: Subset<T, MasterPortCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MasterPortCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MasterPort.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterPortAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MasterPortAggregateArgs>(args: Subset<T, MasterPortAggregateArgs>): Prisma.PrismaPromise<GetMasterPortAggregateType<T>>

    /**
     * Group by MasterPort.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MasterPortGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MasterPortGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MasterPortGroupByArgs['orderBy'] }
        : { orderBy?: MasterPortGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MasterPortGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMasterPortGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MasterPort model
   */
  readonly fields: MasterPortFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MasterPort.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MasterPortClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the MasterPort model
   */ 
  interface MasterPortFieldRefs {
    readonly id: FieldRef<"MasterPort", 'String'>
    readonly country: FieldRef<"MasterPort", 'String'>
    readonly port: FieldRef<"MasterPort", 'String'>
    readonly ratePerKg: FieldRef<"MasterPort", 'Float'>
    readonly isActive: FieldRef<"MasterPort", 'Boolean'>
    readonly updatedAt: FieldRef<"MasterPort", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * MasterPort findUnique
   */
  export type MasterPortFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterPort
     */
    select?: MasterPortSelect<ExtArgs> | null
    /**
     * Filter, which MasterPort to fetch.
     */
    where: MasterPortWhereUniqueInput
  }

  /**
   * MasterPort findUniqueOrThrow
   */
  export type MasterPortFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterPort
     */
    select?: MasterPortSelect<ExtArgs> | null
    /**
     * Filter, which MasterPort to fetch.
     */
    where: MasterPortWhereUniqueInput
  }

  /**
   * MasterPort findFirst
   */
  export type MasterPortFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterPort
     */
    select?: MasterPortSelect<ExtArgs> | null
    /**
     * Filter, which MasterPort to fetch.
     */
    where?: MasterPortWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterPorts to fetch.
     */
    orderBy?: MasterPortOrderByWithRelationInput | MasterPortOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MasterPorts.
     */
    cursor?: MasterPortWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterPorts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterPorts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MasterPorts.
     */
    distinct?: MasterPortScalarFieldEnum | MasterPortScalarFieldEnum[]
  }

  /**
   * MasterPort findFirstOrThrow
   */
  export type MasterPortFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterPort
     */
    select?: MasterPortSelect<ExtArgs> | null
    /**
     * Filter, which MasterPort to fetch.
     */
    where?: MasterPortWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterPorts to fetch.
     */
    orderBy?: MasterPortOrderByWithRelationInput | MasterPortOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MasterPorts.
     */
    cursor?: MasterPortWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterPorts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterPorts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MasterPorts.
     */
    distinct?: MasterPortScalarFieldEnum | MasterPortScalarFieldEnum[]
  }

  /**
   * MasterPort findMany
   */
  export type MasterPortFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterPort
     */
    select?: MasterPortSelect<ExtArgs> | null
    /**
     * Filter, which MasterPorts to fetch.
     */
    where?: MasterPortWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MasterPorts to fetch.
     */
    orderBy?: MasterPortOrderByWithRelationInput | MasterPortOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MasterPorts.
     */
    cursor?: MasterPortWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MasterPorts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MasterPorts.
     */
    skip?: number
    distinct?: MasterPortScalarFieldEnum | MasterPortScalarFieldEnum[]
  }

  /**
   * MasterPort create
   */
  export type MasterPortCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterPort
     */
    select?: MasterPortSelect<ExtArgs> | null
    /**
     * The data needed to create a MasterPort.
     */
    data: XOR<MasterPortCreateInput, MasterPortUncheckedCreateInput>
  }

  /**
   * MasterPort createMany
   */
  export type MasterPortCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MasterPorts.
     */
    data: MasterPortCreateManyInput | MasterPortCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MasterPort createManyAndReturn
   */
  export type MasterPortCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterPort
     */
    select?: MasterPortSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many MasterPorts.
     */
    data: MasterPortCreateManyInput | MasterPortCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MasterPort update
   */
  export type MasterPortUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterPort
     */
    select?: MasterPortSelect<ExtArgs> | null
    /**
     * The data needed to update a MasterPort.
     */
    data: XOR<MasterPortUpdateInput, MasterPortUncheckedUpdateInput>
    /**
     * Choose, which MasterPort to update.
     */
    where: MasterPortWhereUniqueInput
  }

  /**
   * MasterPort updateMany
   */
  export type MasterPortUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MasterPorts.
     */
    data: XOR<MasterPortUpdateManyMutationInput, MasterPortUncheckedUpdateManyInput>
    /**
     * Filter which MasterPorts to update
     */
    where?: MasterPortWhereInput
  }

  /**
   * MasterPort upsert
   */
  export type MasterPortUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterPort
     */
    select?: MasterPortSelect<ExtArgs> | null
    /**
     * The filter to search for the MasterPort to update in case it exists.
     */
    where: MasterPortWhereUniqueInput
    /**
     * In case the MasterPort found by the `where` argument doesn't exist, create a new MasterPort with this data.
     */
    create: XOR<MasterPortCreateInput, MasterPortUncheckedCreateInput>
    /**
     * In case the MasterPort was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MasterPortUpdateInput, MasterPortUncheckedUpdateInput>
  }

  /**
   * MasterPort delete
   */
  export type MasterPortDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterPort
     */
    select?: MasterPortSelect<ExtArgs> | null
    /**
     * Filter which MasterPort to delete.
     */
    where: MasterPortWhereUniqueInput
  }

  /**
   * MasterPort deleteMany
   */
  export type MasterPortDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MasterPorts to delete
     */
    where?: MasterPortWhereInput
  }

  /**
   * MasterPort without action
   */
  export type MasterPortDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MasterPort
     */
    select?: MasterPortSelect<ExtArgs> | null
  }


  /**
   * Model AirRequest
   */

  export type AggregateAirRequest = {
    _count: AirRequestCountAggregateOutputType | null
    _avg: AirRequestAvgAggregateOutputType | null
    _sum: AirRequestSumAggregateOutputType | null
    _min: AirRequestMinAggregateOutputType | null
    _max: AirRequestMaxAggregateOutputType | null
  }

  export type AirRequestAvgAggregateOutputType = {
    actualAirFreight: number | null
  }

  export type AirRequestSumAggregateOutputType = {
    actualAirFreight: number | null
  }

  export type AirRequestMinAggregateOutputType = {
    id: string | null
    documentNo: string | null
    brandName: string | null
    buName: string | null
    status: string | null
    claimDepartment: string | null
    rejectionReason: string | null
    createdById: string | null
    createdAt: Date | null
    updatedAt: Date | null
    invoiceNo: string | null
    actualAirFreight: number | null
    bookingDate: Date | null
    airline: string | null
    assignedVpMer: string | null
    vpMerToken: string | null
    presidentToken: string | null
    scmToken: string | null
    vpScmToken: string | null
    assignedVpScm: string | null
    logisticsToken: string | null
    accountingToken: string | null
    claimNextEmail: string | null
    claimNextToken: string | null
    claimNextName: string | null
    bu: string | null
  }

  export type AirRequestMaxAggregateOutputType = {
    id: string | null
    documentNo: string | null
    brandName: string | null
    buName: string | null
    status: string | null
    claimDepartment: string | null
    rejectionReason: string | null
    createdById: string | null
    createdAt: Date | null
    updatedAt: Date | null
    invoiceNo: string | null
    actualAirFreight: number | null
    bookingDate: Date | null
    airline: string | null
    assignedVpMer: string | null
    vpMerToken: string | null
    presidentToken: string | null
    scmToken: string | null
    vpScmToken: string | null
    assignedVpScm: string | null
    logisticsToken: string | null
    accountingToken: string | null
    claimNextEmail: string | null
    claimNextToken: string | null
    claimNextName: string | null
    bu: string | null
  }

  export type AirRequestCountAggregateOutputType = {
    id: number
    documentNo: number
    brandName: number
    buName: number
    status: number
    claimDepartment: number
    rejectionReason: number
    createdById: number
    createdAt: number
    updatedAt: number
    invoiceNo: number
    actualAirFreight: number
    bookingDate: number
    airline: number
    assignedVpMer: number
    vpMerToken: number
    presidentToken: number
    scmToken: number
    vpScmToken: number
    assignedVpScm: number
    logisticsToken: number
    accountingToken: number
    claimNextEmail: number
    claimNextToken: number
    claimNextName: number
    bu: number
    _all: number
  }


  export type AirRequestAvgAggregateInputType = {
    actualAirFreight?: true
  }

  export type AirRequestSumAggregateInputType = {
    actualAirFreight?: true
  }

  export type AirRequestMinAggregateInputType = {
    id?: true
    documentNo?: true
    brandName?: true
    buName?: true
    status?: true
    claimDepartment?: true
    rejectionReason?: true
    createdById?: true
    createdAt?: true
    updatedAt?: true
    invoiceNo?: true
    actualAirFreight?: true
    bookingDate?: true
    airline?: true
    assignedVpMer?: true
    vpMerToken?: true
    presidentToken?: true
    scmToken?: true
    vpScmToken?: true
    assignedVpScm?: true
    logisticsToken?: true
    accountingToken?: true
    claimNextEmail?: true
    claimNextToken?: true
    claimNextName?: true
    bu?: true
  }

  export type AirRequestMaxAggregateInputType = {
    id?: true
    documentNo?: true
    brandName?: true
    buName?: true
    status?: true
    claimDepartment?: true
    rejectionReason?: true
    createdById?: true
    createdAt?: true
    updatedAt?: true
    invoiceNo?: true
    actualAirFreight?: true
    bookingDate?: true
    airline?: true
    assignedVpMer?: true
    vpMerToken?: true
    presidentToken?: true
    scmToken?: true
    vpScmToken?: true
    assignedVpScm?: true
    logisticsToken?: true
    accountingToken?: true
    claimNextEmail?: true
    claimNextToken?: true
    claimNextName?: true
    bu?: true
  }

  export type AirRequestCountAggregateInputType = {
    id?: true
    documentNo?: true
    brandName?: true
    buName?: true
    status?: true
    claimDepartment?: true
    rejectionReason?: true
    createdById?: true
    createdAt?: true
    updatedAt?: true
    invoiceNo?: true
    actualAirFreight?: true
    bookingDate?: true
    airline?: true
    assignedVpMer?: true
    vpMerToken?: true
    presidentToken?: true
    scmToken?: true
    vpScmToken?: true
    assignedVpScm?: true
    logisticsToken?: true
    accountingToken?: true
    claimNextEmail?: true
    claimNextToken?: true
    claimNextName?: true
    bu?: true
    _all?: true
  }

  export type AirRequestAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AirRequest to aggregate.
     */
    where?: AirRequestWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AirRequests to fetch.
     */
    orderBy?: AirRequestOrderByWithRelationInput | AirRequestOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AirRequestWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AirRequests from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AirRequests.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AirRequests
    **/
    _count?: true | AirRequestCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: AirRequestAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: AirRequestSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AirRequestMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AirRequestMaxAggregateInputType
  }

  export type GetAirRequestAggregateType<T extends AirRequestAggregateArgs> = {
        [P in keyof T & keyof AggregateAirRequest]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAirRequest[P]>
      : GetScalarType<T[P], AggregateAirRequest[P]>
  }




  export type AirRequestGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AirRequestWhereInput
    orderBy?: AirRequestOrderByWithAggregationInput | AirRequestOrderByWithAggregationInput[]
    by: AirRequestScalarFieldEnum[] | AirRequestScalarFieldEnum
    having?: AirRequestScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AirRequestCountAggregateInputType | true
    _avg?: AirRequestAvgAggregateInputType
    _sum?: AirRequestSumAggregateInputType
    _min?: AirRequestMinAggregateInputType
    _max?: AirRequestMaxAggregateInputType
  }

  export type AirRequestGroupByOutputType = {
    id: string
    documentNo: string
    brandName: string
    buName: string
    status: string
    claimDepartment: string | null
    rejectionReason: string | null
    createdById: string
    createdAt: Date
    updatedAt: Date
    invoiceNo: string | null
    actualAirFreight: number | null
    bookingDate: Date | null
    airline: string | null
    assignedVpMer: string | null
    vpMerToken: string | null
    presidentToken: string | null
    scmToken: string | null
    vpScmToken: string | null
    assignedVpScm: string | null
    logisticsToken: string | null
    accountingToken: string | null
    claimNextEmail: string | null
    claimNextToken: string | null
    claimNextName: string | null
    bu: string
    _count: AirRequestCountAggregateOutputType | null
    _avg: AirRequestAvgAggregateOutputType | null
    _sum: AirRequestSumAggregateOutputType | null
    _min: AirRequestMinAggregateOutputType | null
    _max: AirRequestMaxAggregateOutputType | null
  }

  type GetAirRequestGroupByPayload<T extends AirRequestGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AirRequestGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AirRequestGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AirRequestGroupByOutputType[P]>
            : GetScalarType<T[P], AirRequestGroupByOutputType[P]>
        }
      >
    >


  export type AirRequestSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    documentNo?: boolean
    brandName?: boolean
    buName?: boolean
    status?: boolean
    claimDepartment?: boolean
    rejectionReason?: boolean
    createdById?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    invoiceNo?: boolean
    actualAirFreight?: boolean
    bookingDate?: boolean
    airline?: boolean
    assignedVpMer?: boolean
    vpMerToken?: boolean
    presidentToken?: boolean
    scmToken?: boolean
    vpScmToken?: boolean
    assignedVpScm?: boolean
    logisticsToken?: boolean
    accountingToken?: boolean
    claimNextEmail?: boolean
    claimNextToken?: boolean
    claimNextName?: boolean
    bu?: boolean
    createdBy?: boolean | UserDefaultArgs<ExtArgs>
    items?: boolean | AirRequest$itemsArgs<ExtArgs>
    approvalLogs?: boolean | AirRequest$approvalLogsArgs<ExtArgs>
    attachments?: boolean | AirRequest$attachmentsArgs<ExtArgs>
    hawbGroups?: boolean | AirRequest$hawbGroupsArgs<ExtArgs>
    _count?: boolean | AirRequestCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["airRequest"]>

  export type AirRequestSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    documentNo?: boolean
    brandName?: boolean
    buName?: boolean
    status?: boolean
    claimDepartment?: boolean
    rejectionReason?: boolean
    createdById?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    invoiceNo?: boolean
    actualAirFreight?: boolean
    bookingDate?: boolean
    airline?: boolean
    assignedVpMer?: boolean
    vpMerToken?: boolean
    presidentToken?: boolean
    scmToken?: boolean
    vpScmToken?: boolean
    assignedVpScm?: boolean
    logisticsToken?: boolean
    accountingToken?: boolean
    claimNextEmail?: boolean
    claimNextToken?: boolean
    claimNextName?: boolean
    bu?: boolean
    createdBy?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["airRequest"]>

  export type AirRequestSelectScalar = {
    id?: boolean
    documentNo?: boolean
    brandName?: boolean
    buName?: boolean
    status?: boolean
    claimDepartment?: boolean
    rejectionReason?: boolean
    createdById?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    invoiceNo?: boolean
    actualAirFreight?: boolean
    bookingDate?: boolean
    airline?: boolean
    assignedVpMer?: boolean
    vpMerToken?: boolean
    presidentToken?: boolean
    scmToken?: boolean
    vpScmToken?: boolean
    assignedVpScm?: boolean
    logisticsToken?: boolean
    accountingToken?: boolean
    claimNextEmail?: boolean
    claimNextToken?: boolean
    claimNextName?: boolean
    bu?: boolean
  }

  export type AirRequestInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    createdBy?: boolean | UserDefaultArgs<ExtArgs>
    items?: boolean | AirRequest$itemsArgs<ExtArgs>
    approvalLogs?: boolean | AirRequest$approvalLogsArgs<ExtArgs>
    attachments?: boolean | AirRequest$attachmentsArgs<ExtArgs>
    hawbGroups?: boolean | AirRequest$hawbGroupsArgs<ExtArgs>
    _count?: boolean | AirRequestCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type AirRequestIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    createdBy?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $AirRequestPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AirRequest"
    objects: {
      createdBy: Prisma.$UserPayload<ExtArgs>
      items: Prisma.$AirRequestItemPayload<ExtArgs>[]
      approvalLogs: Prisma.$ApprovalLogPayload<ExtArgs>[]
      attachments: Prisma.$RequestAttachmentPayload<ExtArgs>[]
      hawbGroups: Prisma.$HawbGroupPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      documentNo: string
      brandName: string
      buName: string
      status: string
      claimDepartment: string | null
      rejectionReason: string | null
      createdById: string
      createdAt: Date
      updatedAt: Date
      invoiceNo: string | null
      actualAirFreight: number | null
      bookingDate: Date | null
      airline: string | null
      assignedVpMer: string | null
      vpMerToken: string | null
      presidentToken: string | null
      scmToken: string | null
      vpScmToken: string | null
      assignedVpScm: string | null
      logisticsToken: string | null
      accountingToken: string | null
      claimNextEmail: string | null
      claimNextToken: string | null
      claimNextName: string | null
      bu: string
    }, ExtArgs["result"]["airRequest"]>
    composites: {}
  }

  type AirRequestGetPayload<S extends boolean | null | undefined | AirRequestDefaultArgs> = $Result.GetResult<Prisma.$AirRequestPayload, S>

  type AirRequestCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<AirRequestFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: AirRequestCountAggregateInputType | true
    }

  export interface AirRequestDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AirRequest'], meta: { name: 'AirRequest' } }
    /**
     * Find zero or one AirRequest that matches the filter.
     * @param {AirRequestFindUniqueArgs} args - Arguments to find a AirRequest
     * @example
     * // Get one AirRequest
     * const airRequest = await prisma.airRequest.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AirRequestFindUniqueArgs>(args: SelectSubset<T, AirRequestFindUniqueArgs<ExtArgs>>): Prisma__AirRequestClient<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one AirRequest that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {AirRequestFindUniqueOrThrowArgs} args - Arguments to find a AirRequest
     * @example
     * // Get one AirRequest
     * const airRequest = await prisma.airRequest.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AirRequestFindUniqueOrThrowArgs>(args: SelectSubset<T, AirRequestFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AirRequestClient<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first AirRequest that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AirRequestFindFirstArgs} args - Arguments to find a AirRequest
     * @example
     * // Get one AirRequest
     * const airRequest = await prisma.airRequest.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AirRequestFindFirstArgs>(args?: SelectSubset<T, AirRequestFindFirstArgs<ExtArgs>>): Prisma__AirRequestClient<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first AirRequest that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AirRequestFindFirstOrThrowArgs} args - Arguments to find a AirRequest
     * @example
     * // Get one AirRequest
     * const airRequest = await prisma.airRequest.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AirRequestFindFirstOrThrowArgs>(args?: SelectSubset<T, AirRequestFindFirstOrThrowArgs<ExtArgs>>): Prisma__AirRequestClient<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more AirRequests that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AirRequestFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AirRequests
     * const airRequests = await prisma.airRequest.findMany()
     * 
     * // Get first 10 AirRequests
     * const airRequests = await prisma.airRequest.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const airRequestWithIdOnly = await prisma.airRequest.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AirRequestFindManyArgs>(args?: SelectSubset<T, AirRequestFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a AirRequest.
     * @param {AirRequestCreateArgs} args - Arguments to create a AirRequest.
     * @example
     * // Create one AirRequest
     * const AirRequest = await prisma.airRequest.create({
     *   data: {
     *     // ... data to create a AirRequest
     *   }
     * })
     * 
     */
    create<T extends AirRequestCreateArgs>(args: SelectSubset<T, AirRequestCreateArgs<ExtArgs>>): Prisma__AirRequestClient<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many AirRequests.
     * @param {AirRequestCreateManyArgs} args - Arguments to create many AirRequests.
     * @example
     * // Create many AirRequests
     * const airRequest = await prisma.airRequest.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AirRequestCreateManyArgs>(args?: SelectSubset<T, AirRequestCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AirRequests and returns the data saved in the database.
     * @param {AirRequestCreateManyAndReturnArgs} args - Arguments to create many AirRequests.
     * @example
     * // Create many AirRequests
     * const airRequest = await prisma.airRequest.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AirRequests and only return the `id`
     * const airRequestWithIdOnly = await prisma.airRequest.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AirRequestCreateManyAndReturnArgs>(args?: SelectSubset<T, AirRequestCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a AirRequest.
     * @param {AirRequestDeleteArgs} args - Arguments to delete one AirRequest.
     * @example
     * // Delete one AirRequest
     * const AirRequest = await prisma.airRequest.delete({
     *   where: {
     *     // ... filter to delete one AirRequest
     *   }
     * })
     * 
     */
    delete<T extends AirRequestDeleteArgs>(args: SelectSubset<T, AirRequestDeleteArgs<ExtArgs>>): Prisma__AirRequestClient<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one AirRequest.
     * @param {AirRequestUpdateArgs} args - Arguments to update one AirRequest.
     * @example
     * // Update one AirRequest
     * const airRequest = await prisma.airRequest.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AirRequestUpdateArgs>(args: SelectSubset<T, AirRequestUpdateArgs<ExtArgs>>): Prisma__AirRequestClient<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more AirRequests.
     * @param {AirRequestDeleteManyArgs} args - Arguments to filter AirRequests to delete.
     * @example
     * // Delete a few AirRequests
     * const { count } = await prisma.airRequest.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AirRequestDeleteManyArgs>(args?: SelectSubset<T, AirRequestDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AirRequests.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AirRequestUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AirRequests
     * const airRequest = await prisma.airRequest.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AirRequestUpdateManyArgs>(args: SelectSubset<T, AirRequestUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one AirRequest.
     * @param {AirRequestUpsertArgs} args - Arguments to update or create a AirRequest.
     * @example
     * // Update or create a AirRequest
     * const airRequest = await prisma.airRequest.upsert({
     *   create: {
     *     // ... data to create a AirRequest
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AirRequest we want to update
     *   }
     * })
     */
    upsert<T extends AirRequestUpsertArgs>(args: SelectSubset<T, AirRequestUpsertArgs<ExtArgs>>): Prisma__AirRequestClient<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of AirRequests.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AirRequestCountArgs} args - Arguments to filter AirRequests to count.
     * @example
     * // Count the number of AirRequests
     * const count = await prisma.airRequest.count({
     *   where: {
     *     // ... the filter for the AirRequests we want to count
     *   }
     * })
    **/
    count<T extends AirRequestCountArgs>(
      args?: Subset<T, AirRequestCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AirRequestCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AirRequest.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AirRequestAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AirRequestAggregateArgs>(args: Subset<T, AirRequestAggregateArgs>): Prisma.PrismaPromise<GetAirRequestAggregateType<T>>

    /**
     * Group by AirRequest.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AirRequestGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AirRequestGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AirRequestGroupByArgs['orderBy'] }
        : { orderBy?: AirRequestGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AirRequestGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAirRequestGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AirRequest model
   */
  readonly fields: AirRequestFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AirRequest.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AirRequestClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    createdBy<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    items<T extends AirRequest$itemsArgs<ExtArgs> = {}>(args?: Subset<T, AirRequest$itemsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AirRequestItemPayload<ExtArgs>, T, "findMany"> | Null>
    approvalLogs<T extends AirRequest$approvalLogsArgs<ExtArgs> = {}>(args?: Subset<T, AirRequest$approvalLogsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ApprovalLogPayload<ExtArgs>, T, "findMany"> | Null>
    attachments<T extends AirRequest$attachmentsArgs<ExtArgs> = {}>(args?: Subset<T, AirRequest$attachmentsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RequestAttachmentPayload<ExtArgs>, T, "findMany"> | Null>
    hawbGroups<T extends AirRequest$hawbGroupsArgs<ExtArgs> = {}>(args?: Subset<T, AirRequest$hawbGroupsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HawbGroupPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AirRequest model
   */ 
  interface AirRequestFieldRefs {
    readonly id: FieldRef<"AirRequest", 'String'>
    readonly documentNo: FieldRef<"AirRequest", 'String'>
    readonly brandName: FieldRef<"AirRequest", 'String'>
    readonly buName: FieldRef<"AirRequest", 'String'>
    readonly status: FieldRef<"AirRequest", 'String'>
    readonly claimDepartment: FieldRef<"AirRequest", 'String'>
    readonly rejectionReason: FieldRef<"AirRequest", 'String'>
    readonly createdById: FieldRef<"AirRequest", 'String'>
    readonly createdAt: FieldRef<"AirRequest", 'DateTime'>
    readonly updatedAt: FieldRef<"AirRequest", 'DateTime'>
    readonly invoiceNo: FieldRef<"AirRequest", 'String'>
    readonly actualAirFreight: FieldRef<"AirRequest", 'Float'>
    readonly bookingDate: FieldRef<"AirRequest", 'DateTime'>
    readonly airline: FieldRef<"AirRequest", 'String'>
    readonly assignedVpMer: FieldRef<"AirRequest", 'String'>
    readonly vpMerToken: FieldRef<"AirRequest", 'String'>
    readonly presidentToken: FieldRef<"AirRequest", 'String'>
    readonly scmToken: FieldRef<"AirRequest", 'String'>
    readonly vpScmToken: FieldRef<"AirRequest", 'String'>
    readonly assignedVpScm: FieldRef<"AirRequest", 'String'>
    readonly logisticsToken: FieldRef<"AirRequest", 'String'>
    readonly accountingToken: FieldRef<"AirRequest", 'String'>
    readonly claimNextEmail: FieldRef<"AirRequest", 'String'>
    readonly claimNextToken: FieldRef<"AirRequest", 'String'>
    readonly claimNextName: FieldRef<"AirRequest", 'String'>
    readonly bu: FieldRef<"AirRequest", 'String'>
  }
    

  // Custom InputTypes
  /**
   * AirRequest findUnique
   */
  export type AirRequestFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequest
     */
    select?: AirRequestSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestInclude<ExtArgs> | null
    /**
     * Filter, which AirRequest to fetch.
     */
    where: AirRequestWhereUniqueInput
  }

  /**
   * AirRequest findUniqueOrThrow
   */
  export type AirRequestFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequest
     */
    select?: AirRequestSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestInclude<ExtArgs> | null
    /**
     * Filter, which AirRequest to fetch.
     */
    where: AirRequestWhereUniqueInput
  }

  /**
   * AirRequest findFirst
   */
  export type AirRequestFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequest
     */
    select?: AirRequestSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestInclude<ExtArgs> | null
    /**
     * Filter, which AirRequest to fetch.
     */
    where?: AirRequestWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AirRequests to fetch.
     */
    orderBy?: AirRequestOrderByWithRelationInput | AirRequestOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AirRequests.
     */
    cursor?: AirRequestWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AirRequests from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AirRequests.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AirRequests.
     */
    distinct?: AirRequestScalarFieldEnum | AirRequestScalarFieldEnum[]
  }

  /**
   * AirRequest findFirstOrThrow
   */
  export type AirRequestFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequest
     */
    select?: AirRequestSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestInclude<ExtArgs> | null
    /**
     * Filter, which AirRequest to fetch.
     */
    where?: AirRequestWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AirRequests to fetch.
     */
    orderBy?: AirRequestOrderByWithRelationInput | AirRequestOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AirRequests.
     */
    cursor?: AirRequestWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AirRequests from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AirRequests.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AirRequests.
     */
    distinct?: AirRequestScalarFieldEnum | AirRequestScalarFieldEnum[]
  }

  /**
   * AirRequest findMany
   */
  export type AirRequestFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequest
     */
    select?: AirRequestSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestInclude<ExtArgs> | null
    /**
     * Filter, which AirRequests to fetch.
     */
    where?: AirRequestWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AirRequests to fetch.
     */
    orderBy?: AirRequestOrderByWithRelationInput | AirRequestOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AirRequests.
     */
    cursor?: AirRequestWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AirRequests from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AirRequests.
     */
    skip?: number
    distinct?: AirRequestScalarFieldEnum | AirRequestScalarFieldEnum[]
  }

  /**
   * AirRequest create
   */
  export type AirRequestCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequest
     */
    select?: AirRequestSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestInclude<ExtArgs> | null
    /**
     * The data needed to create a AirRequest.
     */
    data: XOR<AirRequestCreateInput, AirRequestUncheckedCreateInput>
  }

  /**
   * AirRequest createMany
   */
  export type AirRequestCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AirRequests.
     */
    data: AirRequestCreateManyInput | AirRequestCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AirRequest createManyAndReturn
   */
  export type AirRequestCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequest
     */
    select?: AirRequestSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many AirRequests.
     */
    data: AirRequestCreateManyInput | AirRequestCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * AirRequest update
   */
  export type AirRequestUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequest
     */
    select?: AirRequestSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestInclude<ExtArgs> | null
    /**
     * The data needed to update a AirRequest.
     */
    data: XOR<AirRequestUpdateInput, AirRequestUncheckedUpdateInput>
    /**
     * Choose, which AirRequest to update.
     */
    where: AirRequestWhereUniqueInput
  }

  /**
   * AirRequest updateMany
   */
  export type AirRequestUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AirRequests.
     */
    data: XOR<AirRequestUpdateManyMutationInput, AirRequestUncheckedUpdateManyInput>
    /**
     * Filter which AirRequests to update
     */
    where?: AirRequestWhereInput
  }

  /**
   * AirRequest upsert
   */
  export type AirRequestUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequest
     */
    select?: AirRequestSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestInclude<ExtArgs> | null
    /**
     * The filter to search for the AirRequest to update in case it exists.
     */
    where: AirRequestWhereUniqueInput
    /**
     * In case the AirRequest found by the `where` argument doesn't exist, create a new AirRequest with this data.
     */
    create: XOR<AirRequestCreateInput, AirRequestUncheckedCreateInput>
    /**
     * In case the AirRequest was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AirRequestUpdateInput, AirRequestUncheckedUpdateInput>
  }

  /**
   * AirRequest delete
   */
  export type AirRequestDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequest
     */
    select?: AirRequestSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestInclude<ExtArgs> | null
    /**
     * Filter which AirRequest to delete.
     */
    where: AirRequestWhereUniqueInput
  }

  /**
   * AirRequest deleteMany
   */
  export type AirRequestDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AirRequests to delete
     */
    where?: AirRequestWhereInput
  }

  /**
   * AirRequest.items
   */
  export type AirRequest$itemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestItem
     */
    select?: AirRequestItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestItemInclude<ExtArgs> | null
    where?: AirRequestItemWhereInput
    orderBy?: AirRequestItemOrderByWithRelationInput | AirRequestItemOrderByWithRelationInput[]
    cursor?: AirRequestItemWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AirRequestItemScalarFieldEnum | AirRequestItemScalarFieldEnum[]
  }

  /**
   * AirRequest.approvalLogs
   */
  export type AirRequest$approvalLogsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ApprovalLog
     */
    select?: ApprovalLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ApprovalLogInclude<ExtArgs> | null
    where?: ApprovalLogWhereInput
    orderBy?: ApprovalLogOrderByWithRelationInput | ApprovalLogOrderByWithRelationInput[]
    cursor?: ApprovalLogWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ApprovalLogScalarFieldEnum | ApprovalLogScalarFieldEnum[]
  }

  /**
   * AirRequest.attachments
   */
  export type AirRequest$attachmentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RequestAttachment
     */
    select?: RequestAttachmentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RequestAttachmentInclude<ExtArgs> | null
    where?: RequestAttachmentWhereInput
    orderBy?: RequestAttachmentOrderByWithRelationInput | RequestAttachmentOrderByWithRelationInput[]
    cursor?: RequestAttachmentWhereUniqueInput
    take?: number
    skip?: number
    distinct?: RequestAttachmentScalarFieldEnum | RequestAttachmentScalarFieldEnum[]
  }

  /**
   * AirRequest.hawbGroups
   */
  export type AirRequest$hawbGroupsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HawbGroup
     */
    select?: HawbGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HawbGroupInclude<ExtArgs> | null
    where?: HawbGroupWhereInput
    orderBy?: HawbGroupOrderByWithRelationInput | HawbGroupOrderByWithRelationInput[]
    cursor?: HawbGroupWhereUniqueInput
    take?: number
    skip?: number
    distinct?: HawbGroupScalarFieldEnum | HawbGroupScalarFieldEnum[]
  }

  /**
   * AirRequest without action
   */
  export type AirRequestDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequest
     */
    select?: AirRequestSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestInclude<ExtArgs> | null
  }


  /**
   * Model ClaimApproval
   */

  export type AggregateClaimApproval = {
    _count: ClaimApprovalCountAggregateOutputType | null
    _min: ClaimApprovalMinAggregateOutputType | null
    _max: ClaimApprovalMaxAggregateOutputType | null
  }

  export type ClaimApprovalMinAggregateOutputType = {
    id: string | null
    itemId: string | null
    userId: string | null
    role: string | null
    createdAt: Date | null
  }

  export type ClaimApprovalMaxAggregateOutputType = {
    id: string | null
    itemId: string | null
    userId: string | null
    role: string | null
    createdAt: Date | null
  }

  export type ClaimApprovalCountAggregateOutputType = {
    id: number
    itemId: number
    userId: number
    role: number
    createdAt: number
    _all: number
  }


  export type ClaimApprovalMinAggregateInputType = {
    id?: true
    itemId?: true
    userId?: true
    role?: true
    createdAt?: true
  }

  export type ClaimApprovalMaxAggregateInputType = {
    id?: true
    itemId?: true
    userId?: true
    role?: true
    createdAt?: true
  }

  export type ClaimApprovalCountAggregateInputType = {
    id?: true
    itemId?: true
    userId?: true
    role?: true
    createdAt?: true
    _all?: true
  }

  export type ClaimApprovalAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ClaimApproval to aggregate.
     */
    where?: ClaimApprovalWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClaimApprovals to fetch.
     */
    orderBy?: ClaimApprovalOrderByWithRelationInput | ClaimApprovalOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ClaimApprovalWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClaimApprovals from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClaimApprovals.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ClaimApprovals
    **/
    _count?: true | ClaimApprovalCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ClaimApprovalMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ClaimApprovalMaxAggregateInputType
  }

  export type GetClaimApprovalAggregateType<T extends ClaimApprovalAggregateArgs> = {
        [P in keyof T & keyof AggregateClaimApproval]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateClaimApproval[P]>
      : GetScalarType<T[P], AggregateClaimApproval[P]>
  }




  export type ClaimApprovalGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClaimApprovalWhereInput
    orderBy?: ClaimApprovalOrderByWithAggregationInput | ClaimApprovalOrderByWithAggregationInput[]
    by: ClaimApprovalScalarFieldEnum[] | ClaimApprovalScalarFieldEnum
    having?: ClaimApprovalScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ClaimApprovalCountAggregateInputType | true
    _min?: ClaimApprovalMinAggregateInputType
    _max?: ClaimApprovalMaxAggregateInputType
  }

  export type ClaimApprovalGroupByOutputType = {
    id: string
    itemId: string
    userId: string
    role: string
    createdAt: Date
    _count: ClaimApprovalCountAggregateOutputType | null
    _min: ClaimApprovalMinAggregateOutputType | null
    _max: ClaimApprovalMaxAggregateOutputType | null
  }

  type GetClaimApprovalGroupByPayload<T extends ClaimApprovalGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ClaimApprovalGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ClaimApprovalGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ClaimApprovalGroupByOutputType[P]>
            : GetScalarType<T[P], ClaimApprovalGroupByOutputType[P]>
        }
      >
    >


  export type ClaimApprovalSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    itemId?: boolean
    userId?: boolean
    role?: boolean
    createdAt?: boolean
    item?: boolean | AirRequestItemDefaultArgs<ExtArgs>
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["claimApproval"]>

  export type ClaimApprovalSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    itemId?: boolean
    userId?: boolean
    role?: boolean
    createdAt?: boolean
    item?: boolean | AirRequestItemDefaultArgs<ExtArgs>
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["claimApproval"]>

  export type ClaimApprovalSelectScalar = {
    id?: boolean
    itemId?: boolean
    userId?: boolean
    role?: boolean
    createdAt?: boolean
  }

  export type ClaimApprovalInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    item?: boolean | AirRequestItemDefaultArgs<ExtArgs>
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type ClaimApprovalIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    item?: boolean | AirRequestItemDefaultArgs<ExtArgs>
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $ClaimApprovalPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ClaimApproval"
    objects: {
      item: Prisma.$AirRequestItemPayload<ExtArgs>
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      itemId: string
      userId: string
      role: string
      createdAt: Date
    }, ExtArgs["result"]["claimApproval"]>
    composites: {}
  }

  type ClaimApprovalGetPayload<S extends boolean | null | undefined | ClaimApprovalDefaultArgs> = $Result.GetResult<Prisma.$ClaimApprovalPayload, S>

  type ClaimApprovalCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ClaimApprovalFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ClaimApprovalCountAggregateInputType | true
    }

  export interface ClaimApprovalDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ClaimApproval'], meta: { name: 'ClaimApproval' } }
    /**
     * Find zero or one ClaimApproval that matches the filter.
     * @param {ClaimApprovalFindUniqueArgs} args - Arguments to find a ClaimApproval
     * @example
     * // Get one ClaimApproval
     * const claimApproval = await prisma.claimApproval.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ClaimApprovalFindUniqueArgs>(args: SelectSubset<T, ClaimApprovalFindUniqueArgs<ExtArgs>>): Prisma__ClaimApprovalClient<$Result.GetResult<Prisma.$ClaimApprovalPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one ClaimApproval that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ClaimApprovalFindUniqueOrThrowArgs} args - Arguments to find a ClaimApproval
     * @example
     * // Get one ClaimApproval
     * const claimApproval = await prisma.claimApproval.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ClaimApprovalFindUniqueOrThrowArgs>(args: SelectSubset<T, ClaimApprovalFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ClaimApprovalClient<$Result.GetResult<Prisma.$ClaimApprovalPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first ClaimApproval that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimApprovalFindFirstArgs} args - Arguments to find a ClaimApproval
     * @example
     * // Get one ClaimApproval
     * const claimApproval = await prisma.claimApproval.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ClaimApprovalFindFirstArgs>(args?: SelectSubset<T, ClaimApprovalFindFirstArgs<ExtArgs>>): Prisma__ClaimApprovalClient<$Result.GetResult<Prisma.$ClaimApprovalPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first ClaimApproval that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimApprovalFindFirstOrThrowArgs} args - Arguments to find a ClaimApproval
     * @example
     * // Get one ClaimApproval
     * const claimApproval = await prisma.claimApproval.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ClaimApprovalFindFirstOrThrowArgs>(args?: SelectSubset<T, ClaimApprovalFindFirstOrThrowArgs<ExtArgs>>): Prisma__ClaimApprovalClient<$Result.GetResult<Prisma.$ClaimApprovalPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more ClaimApprovals that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimApprovalFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ClaimApprovals
     * const claimApprovals = await prisma.claimApproval.findMany()
     * 
     * // Get first 10 ClaimApprovals
     * const claimApprovals = await prisma.claimApproval.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const claimApprovalWithIdOnly = await prisma.claimApproval.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ClaimApprovalFindManyArgs>(args?: SelectSubset<T, ClaimApprovalFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClaimApprovalPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a ClaimApproval.
     * @param {ClaimApprovalCreateArgs} args - Arguments to create a ClaimApproval.
     * @example
     * // Create one ClaimApproval
     * const ClaimApproval = await prisma.claimApproval.create({
     *   data: {
     *     // ... data to create a ClaimApproval
     *   }
     * })
     * 
     */
    create<T extends ClaimApprovalCreateArgs>(args: SelectSubset<T, ClaimApprovalCreateArgs<ExtArgs>>): Prisma__ClaimApprovalClient<$Result.GetResult<Prisma.$ClaimApprovalPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many ClaimApprovals.
     * @param {ClaimApprovalCreateManyArgs} args - Arguments to create many ClaimApprovals.
     * @example
     * // Create many ClaimApprovals
     * const claimApproval = await prisma.claimApproval.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ClaimApprovalCreateManyArgs>(args?: SelectSubset<T, ClaimApprovalCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ClaimApprovals and returns the data saved in the database.
     * @param {ClaimApprovalCreateManyAndReturnArgs} args - Arguments to create many ClaimApprovals.
     * @example
     * // Create many ClaimApprovals
     * const claimApproval = await prisma.claimApproval.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ClaimApprovals and only return the `id`
     * const claimApprovalWithIdOnly = await prisma.claimApproval.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ClaimApprovalCreateManyAndReturnArgs>(args?: SelectSubset<T, ClaimApprovalCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClaimApprovalPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a ClaimApproval.
     * @param {ClaimApprovalDeleteArgs} args - Arguments to delete one ClaimApproval.
     * @example
     * // Delete one ClaimApproval
     * const ClaimApproval = await prisma.claimApproval.delete({
     *   where: {
     *     // ... filter to delete one ClaimApproval
     *   }
     * })
     * 
     */
    delete<T extends ClaimApprovalDeleteArgs>(args: SelectSubset<T, ClaimApprovalDeleteArgs<ExtArgs>>): Prisma__ClaimApprovalClient<$Result.GetResult<Prisma.$ClaimApprovalPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one ClaimApproval.
     * @param {ClaimApprovalUpdateArgs} args - Arguments to update one ClaimApproval.
     * @example
     * // Update one ClaimApproval
     * const claimApproval = await prisma.claimApproval.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ClaimApprovalUpdateArgs>(args: SelectSubset<T, ClaimApprovalUpdateArgs<ExtArgs>>): Prisma__ClaimApprovalClient<$Result.GetResult<Prisma.$ClaimApprovalPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more ClaimApprovals.
     * @param {ClaimApprovalDeleteManyArgs} args - Arguments to filter ClaimApprovals to delete.
     * @example
     * // Delete a few ClaimApprovals
     * const { count } = await prisma.claimApproval.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ClaimApprovalDeleteManyArgs>(args?: SelectSubset<T, ClaimApprovalDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ClaimApprovals.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimApprovalUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ClaimApprovals
     * const claimApproval = await prisma.claimApproval.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ClaimApprovalUpdateManyArgs>(args: SelectSubset<T, ClaimApprovalUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one ClaimApproval.
     * @param {ClaimApprovalUpsertArgs} args - Arguments to update or create a ClaimApproval.
     * @example
     * // Update or create a ClaimApproval
     * const claimApproval = await prisma.claimApproval.upsert({
     *   create: {
     *     // ... data to create a ClaimApproval
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ClaimApproval we want to update
     *   }
     * })
     */
    upsert<T extends ClaimApprovalUpsertArgs>(args: SelectSubset<T, ClaimApprovalUpsertArgs<ExtArgs>>): Prisma__ClaimApprovalClient<$Result.GetResult<Prisma.$ClaimApprovalPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of ClaimApprovals.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimApprovalCountArgs} args - Arguments to filter ClaimApprovals to count.
     * @example
     * // Count the number of ClaimApprovals
     * const count = await prisma.claimApproval.count({
     *   where: {
     *     // ... the filter for the ClaimApprovals we want to count
     *   }
     * })
    **/
    count<T extends ClaimApprovalCountArgs>(
      args?: Subset<T, ClaimApprovalCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ClaimApprovalCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ClaimApproval.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimApprovalAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ClaimApprovalAggregateArgs>(args: Subset<T, ClaimApprovalAggregateArgs>): Prisma.PrismaPromise<GetClaimApprovalAggregateType<T>>

    /**
     * Group by ClaimApproval.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClaimApprovalGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ClaimApprovalGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ClaimApprovalGroupByArgs['orderBy'] }
        : { orderBy?: ClaimApprovalGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ClaimApprovalGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetClaimApprovalGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ClaimApproval model
   */
  readonly fields: ClaimApprovalFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ClaimApproval.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ClaimApprovalClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    item<T extends AirRequestItemDefaultArgs<ExtArgs> = {}>(args?: Subset<T, AirRequestItemDefaultArgs<ExtArgs>>): Prisma__AirRequestItemClient<$Result.GetResult<Prisma.$AirRequestItemPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ClaimApproval model
   */ 
  interface ClaimApprovalFieldRefs {
    readonly id: FieldRef<"ClaimApproval", 'String'>
    readonly itemId: FieldRef<"ClaimApproval", 'String'>
    readonly userId: FieldRef<"ClaimApproval", 'String'>
    readonly role: FieldRef<"ClaimApproval", 'String'>
    readonly createdAt: FieldRef<"ClaimApproval", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ClaimApproval findUnique
   */
  export type ClaimApprovalFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimApproval
     */
    select?: ClaimApprovalSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimApprovalInclude<ExtArgs> | null
    /**
     * Filter, which ClaimApproval to fetch.
     */
    where: ClaimApprovalWhereUniqueInput
  }

  /**
   * ClaimApproval findUniqueOrThrow
   */
  export type ClaimApprovalFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimApproval
     */
    select?: ClaimApprovalSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimApprovalInclude<ExtArgs> | null
    /**
     * Filter, which ClaimApproval to fetch.
     */
    where: ClaimApprovalWhereUniqueInput
  }

  /**
   * ClaimApproval findFirst
   */
  export type ClaimApprovalFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimApproval
     */
    select?: ClaimApprovalSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimApprovalInclude<ExtArgs> | null
    /**
     * Filter, which ClaimApproval to fetch.
     */
    where?: ClaimApprovalWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClaimApprovals to fetch.
     */
    orderBy?: ClaimApprovalOrderByWithRelationInput | ClaimApprovalOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ClaimApprovals.
     */
    cursor?: ClaimApprovalWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClaimApprovals from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClaimApprovals.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ClaimApprovals.
     */
    distinct?: ClaimApprovalScalarFieldEnum | ClaimApprovalScalarFieldEnum[]
  }

  /**
   * ClaimApproval findFirstOrThrow
   */
  export type ClaimApprovalFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimApproval
     */
    select?: ClaimApprovalSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimApprovalInclude<ExtArgs> | null
    /**
     * Filter, which ClaimApproval to fetch.
     */
    where?: ClaimApprovalWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClaimApprovals to fetch.
     */
    orderBy?: ClaimApprovalOrderByWithRelationInput | ClaimApprovalOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ClaimApprovals.
     */
    cursor?: ClaimApprovalWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClaimApprovals from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClaimApprovals.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ClaimApprovals.
     */
    distinct?: ClaimApprovalScalarFieldEnum | ClaimApprovalScalarFieldEnum[]
  }

  /**
   * ClaimApproval findMany
   */
  export type ClaimApprovalFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimApproval
     */
    select?: ClaimApprovalSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimApprovalInclude<ExtArgs> | null
    /**
     * Filter, which ClaimApprovals to fetch.
     */
    where?: ClaimApprovalWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClaimApprovals to fetch.
     */
    orderBy?: ClaimApprovalOrderByWithRelationInput | ClaimApprovalOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ClaimApprovals.
     */
    cursor?: ClaimApprovalWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClaimApprovals from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClaimApprovals.
     */
    skip?: number
    distinct?: ClaimApprovalScalarFieldEnum | ClaimApprovalScalarFieldEnum[]
  }

  /**
   * ClaimApproval create
   */
  export type ClaimApprovalCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimApproval
     */
    select?: ClaimApprovalSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimApprovalInclude<ExtArgs> | null
    /**
     * The data needed to create a ClaimApproval.
     */
    data: XOR<ClaimApprovalCreateInput, ClaimApprovalUncheckedCreateInput>
  }

  /**
   * ClaimApproval createMany
   */
  export type ClaimApprovalCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ClaimApprovals.
     */
    data: ClaimApprovalCreateManyInput | ClaimApprovalCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ClaimApproval createManyAndReturn
   */
  export type ClaimApprovalCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimApproval
     */
    select?: ClaimApprovalSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many ClaimApprovals.
     */
    data: ClaimApprovalCreateManyInput | ClaimApprovalCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimApprovalIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ClaimApproval update
   */
  export type ClaimApprovalUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimApproval
     */
    select?: ClaimApprovalSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimApprovalInclude<ExtArgs> | null
    /**
     * The data needed to update a ClaimApproval.
     */
    data: XOR<ClaimApprovalUpdateInput, ClaimApprovalUncheckedUpdateInput>
    /**
     * Choose, which ClaimApproval to update.
     */
    where: ClaimApprovalWhereUniqueInput
  }

  /**
   * ClaimApproval updateMany
   */
  export type ClaimApprovalUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ClaimApprovals.
     */
    data: XOR<ClaimApprovalUpdateManyMutationInput, ClaimApprovalUncheckedUpdateManyInput>
    /**
     * Filter which ClaimApprovals to update
     */
    where?: ClaimApprovalWhereInput
  }

  /**
   * ClaimApproval upsert
   */
  export type ClaimApprovalUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimApproval
     */
    select?: ClaimApprovalSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimApprovalInclude<ExtArgs> | null
    /**
     * The filter to search for the ClaimApproval to update in case it exists.
     */
    where: ClaimApprovalWhereUniqueInput
    /**
     * In case the ClaimApproval found by the `where` argument doesn't exist, create a new ClaimApproval with this data.
     */
    create: XOR<ClaimApprovalCreateInput, ClaimApprovalUncheckedCreateInput>
    /**
     * In case the ClaimApproval was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ClaimApprovalUpdateInput, ClaimApprovalUncheckedUpdateInput>
  }

  /**
   * ClaimApproval delete
   */
  export type ClaimApprovalDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimApproval
     */
    select?: ClaimApprovalSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimApprovalInclude<ExtArgs> | null
    /**
     * Filter which ClaimApproval to delete.
     */
    where: ClaimApprovalWhereUniqueInput
  }

  /**
   * ClaimApproval deleteMany
   */
  export type ClaimApprovalDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ClaimApprovals to delete
     */
    where?: ClaimApprovalWhereInput
  }

  /**
   * ClaimApproval without action
   */
  export type ClaimApprovalDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimApproval
     */
    select?: ClaimApprovalSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimApprovalInclude<ExtArgs> | null
  }


  /**
   * Model HawbGroup
   */

  export type AggregateHawbGroup = {
    _count: HawbGroupCountAggregateOutputType | null
    _avg: HawbGroupAvgAggregateOutputType | null
    _sum: HawbGroupSumAggregateOutputType | null
    _min: HawbGroupMinAggregateOutputType | null
    _max: HawbGroupMaxAggregateOutputType | null
  }

  export type HawbGroupAvgAggregateOutputType = {
    totalCharge: number | null
  }

  export type HawbGroupSumAggregateOutputType = {
    totalCharge: number | null
  }

  export type HawbGroupMinAggregateOutputType = {
    id: string | null
    requestId: string | null
    hawbNo: string | null
    totalCharge: number | null
    createdAt: Date | null
  }

  export type HawbGroupMaxAggregateOutputType = {
    id: string | null
    requestId: string | null
    hawbNo: string | null
    totalCharge: number | null
    createdAt: Date | null
  }

  export type HawbGroupCountAggregateOutputType = {
    id: number
    requestId: number
    hawbNo: number
    totalCharge: number
    createdAt: number
    _all: number
  }


  export type HawbGroupAvgAggregateInputType = {
    totalCharge?: true
  }

  export type HawbGroupSumAggregateInputType = {
    totalCharge?: true
  }

  export type HawbGroupMinAggregateInputType = {
    id?: true
    requestId?: true
    hawbNo?: true
    totalCharge?: true
    createdAt?: true
  }

  export type HawbGroupMaxAggregateInputType = {
    id?: true
    requestId?: true
    hawbNo?: true
    totalCharge?: true
    createdAt?: true
  }

  export type HawbGroupCountAggregateInputType = {
    id?: true
    requestId?: true
    hawbNo?: true
    totalCharge?: true
    createdAt?: true
    _all?: true
  }

  export type HawbGroupAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which HawbGroup to aggregate.
     */
    where?: HawbGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HawbGroups to fetch.
     */
    orderBy?: HawbGroupOrderByWithRelationInput | HawbGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: HawbGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HawbGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HawbGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned HawbGroups
    **/
    _count?: true | HawbGroupCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: HawbGroupAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: HawbGroupSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: HawbGroupMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: HawbGroupMaxAggregateInputType
  }

  export type GetHawbGroupAggregateType<T extends HawbGroupAggregateArgs> = {
        [P in keyof T & keyof AggregateHawbGroup]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateHawbGroup[P]>
      : GetScalarType<T[P], AggregateHawbGroup[P]>
  }




  export type HawbGroupGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: HawbGroupWhereInput
    orderBy?: HawbGroupOrderByWithAggregationInput | HawbGroupOrderByWithAggregationInput[]
    by: HawbGroupScalarFieldEnum[] | HawbGroupScalarFieldEnum
    having?: HawbGroupScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: HawbGroupCountAggregateInputType | true
    _avg?: HawbGroupAvgAggregateInputType
    _sum?: HawbGroupSumAggregateInputType
    _min?: HawbGroupMinAggregateInputType
    _max?: HawbGroupMaxAggregateInputType
  }

  export type HawbGroupGroupByOutputType = {
    id: string
    requestId: string
    hawbNo: string
    totalCharge: number
    createdAt: Date
    _count: HawbGroupCountAggregateOutputType | null
    _avg: HawbGroupAvgAggregateOutputType | null
    _sum: HawbGroupSumAggregateOutputType | null
    _min: HawbGroupMinAggregateOutputType | null
    _max: HawbGroupMaxAggregateOutputType | null
  }

  type GetHawbGroupGroupByPayload<T extends HawbGroupGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<HawbGroupGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof HawbGroupGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], HawbGroupGroupByOutputType[P]>
            : GetScalarType<T[P], HawbGroupGroupByOutputType[P]>
        }
      >
    >


  export type HawbGroupSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    requestId?: boolean
    hawbNo?: boolean
    totalCharge?: boolean
    createdAt?: boolean
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
    items?: boolean | HawbGroup$itemsArgs<ExtArgs>
    _count?: boolean | HawbGroupCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["hawbGroup"]>

  export type HawbGroupSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    requestId?: boolean
    hawbNo?: boolean
    totalCharge?: boolean
    createdAt?: boolean
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["hawbGroup"]>

  export type HawbGroupSelectScalar = {
    id?: boolean
    requestId?: boolean
    hawbNo?: boolean
    totalCharge?: boolean
    createdAt?: boolean
  }

  export type HawbGroupInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
    items?: boolean | HawbGroup$itemsArgs<ExtArgs>
    _count?: boolean | HawbGroupCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type HawbGroupIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
  }

  export type $HawbGroupPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "HawbGroup"
    objects: {
      request: Prisma.$AirRequestPayload<ExtArgs>
      items: Prisma.$AirRequestItemPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      requestId: string
      hawbNo: string
      totalCharge: number
      createdAt: Date
    }, ExtArgs["result"]["hawbGroup"]>
    composites: {}
  }

  type HawbGroupGetPayload<S extends boolean | null | undefined | HawbGroupDefaultArgs> = $Result.GetResult<Prisma.$HawbGroupPayload, S>

  type HawbGroupCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<HawbGroupFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: HawbGroupCountAggregateInputType | true
    }

  export interface HawbGroupDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['HawbGroup'], meta: { name: 'HawbGroup' } }
    /**
     * Find zero or one HawbGroup that matches the filter.
     * @param {HawbGroupFindUniqueArgs} args - Arguments to find a HawbGroup
     * @example
     * // Get one HawbGroup
     * const hawbGroup = await prisma.hawbGroup.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends HawbGroupFindUniqueArgs>(args: SelectSubset<T, HawbGroupFindUniqueArgs<ExtArgs>>): Prisma__HawbGroupClient<$Result.GetResult<Prisma.$HawbGroupPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one HawbGroup that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {HawbGroupFindUniqueOrThrowArgs} args - Arguments to find a HawbGroup
     * @example
     * // Get one HawbGroup
     * const hawbGroup = await prisma.hawbGroup.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends HawbGroupFindUniqueOrThrowArgs>(args: SelectSubset<T, HawbGroupFindUniqueOrThrowArgs<ExtArgs>>): Prisma__HawbGroupClient<$Result.GetResult<Prisma.$HawbGroupPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first HawbGroup that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HawbGroupFindFirstArgs} args - Arguments to find a HawbGroup
     * @example
     * // Get one HawbGroup
     * const hawbGroup = await prisma.hawbGroup.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends HawbGroupFindFirstArgs>(args?: SelectSubset<T, HawbGroupFindFirstArgs<ExtArgs>>): Prisma__HawbGroupClient<$Result.GetResult<Prisma.$HawbGroupPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first HawbGroup that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HawbGroupFindFirstOrThrowArgs} args - Arguments to find a HawbGroup
     * @example
     * // Get one HawbGroup
     * const hawbGroup = await prisma.hawbGroup.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends HawbGroupFindFirstOrThrowArgs>(args?: SelectSubset<T, HawbGroupFindFirstOrThrowArgs<ExtArgs>>): Prisma__HawbGroupClient<$Result.GetResult<Prisma.$HawbGroupPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more HawbGroups that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HawbGroupFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all HawbGroups
     * const hawbGroups = await prisma.hawbGroup.findMany()
     * 
     * // Get first 10 HawbGroups
     * const hawbGroups = await prisma.hawbGroup.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const hawbGroupWithIdOnly = await prisma.hawbGroup.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends HawbGroupFindManyArgs>(args?: SelectSubset<T, HawbGroupFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HawbGroupPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a HawbGroup.
     * @param {HawbGroupCreateArgs} args - Arguments to create a HawbGroup.
     * @example
     * // Create one HawbGroup
     * const HawbGroup = await prisma.hawbGroup.create({
     *   data: {
     *     // ... data to create a HawbGroup
     *   }
     * })
     * 
     */
    create<T extends HawbGroupCreateArgs>(args: SelectSubset<T, HawbGroupCreateArgs<ExtArgs>>): Prisma__HawbGroupClient<$Result.GetResult<Prisma.$HawbGroupPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many HawbGroups.
     * @param {HawbGroupCreateManyArgs} args - Arguments to create many HawbGroups.
     * @example
     * // Create many HawbGroups
     * const hawbGroup = await prisma.hawbGroup.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends HawbGroupCreateManyArgs>(args?: SelectSubset<T, HawbGroupCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many HawbGroups and returns the data saved in the database.
     * @param {HawbGroupCreateManyAndReturnArgs} args - Arguments to create many HawbGroups.
     * @example
     * // Create many HawbGroups
     * const hawbGroup = await prisma.hawbGroup.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many HawbGroups and only return the `id`
     * const hawbGroupWithIdOnly = await prisma.hawbGroup.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends HawbGroupCreateManyAndReturnArgs>(args?: SelectSubset<T, HawbGroupCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HawbGroupPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a HawbGroup.
     * @param {HawbGroupDeleteArgs} args - Arguments to delete one HawbGroup.
     * @example
     * // Delete one HawbGroup
     * const HawbGroup = await prisma.hawbGroup.delete({
     *   where: {
     *     // ... filter to delete one HawbGroup
     *   }
     * })
     * 
     */
    delete<T extends HawbGroupDeleteArgs>(args: SelectSubset<T, HawbGroupDeleteArgs<ExtArgs>>): Prisma__HawbGroupClient<$Result.GetResult<Prisma.$HawbGroupPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one HawbGroup.
     * @param {HawbGroupUpdateArgs} args - Arguments to update one HawbGroup.
     * @example
     * // Update one HawbGroup
     * const hawbGroup = await prisma.hawbGroup.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends HawbGroupUpdateArgs>(args: SelectSubset<T, HawbGroupUpdateArgs<ExtArgs>>): Prisma__HawbGroupClient<$Result.GetResult<Prisma.$HawbGroupPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more HawbGroups.
     * @param {HawbGroupDeleteManyArgs} args - Arguments to filter HawbGroups to delete.
     * @example
     * // Delete a few HawbGroups
     * const { count } = await prisma.hawbGroup.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends HawbGroupDeleteManyArgs>(args?: SelectSubset<T, HawbGroupDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more HawbGroups.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HawbGroupUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many HawbGroups
     * const hawbGroup = await prisma.hawbGroup.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends HawbGroupUpdateManyArgs>(args: SelectSubset<T, HawbGroupUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one HawbGroup.
     * @param {HawbGroupUpsertArgs} args - Arguments to update or create a HawbGroup.
     * @example
     * // Update or create a HawbGroup
     * const hawbGroup = await prisma.hawbGroup.upsert({
     *   create: {
     *     // ... data to create a HawbGroup
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the HawbGroup we want to update
     *   }
     * })
     */
    upsert<T extends HawbGroupUpsertArgs>(args: SelectSubset<T, HawbGroupUpsertArgs<ExtArgs>>): Prisma__HawbGroupClient<$Result.GetResult<Prisma.$HawbGroupPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of HawbGroups.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HawbGroupCountArgs} args - Arguments to filter HawbGroups to count.
     * @example
     * // Count the number of HawbGroups
     * const count = await prisma.hawbGroup.count({
     *   where: {
     *     // ... the filter for the HawbGroups we want to count
     *   }
     * })
    **/
    count<T extends HawbGroupCountArgs>(
      args?: Subset<T, HawbGroupCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], HawbGroupCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a HawbGroup.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HawbGroupAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends HawbGroupAggregateArgs>(args: Subset<T, HawbGroupAggregateArgs>): Prisma.PrismaPromise<GetHawbGroupAggregateType<T>>

    /**
     * Group by HawbGroup.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HawbGroupGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends HawbGroupGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: HawbGroupGroupByArgs['orderBy'] }
        : { orderBy?: HawbGroupGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, HawbGroupGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetHawbGroupGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the HawbGroup model
   */
  readonly fields: HawbGroupFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for HawbGroup.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__HawbGroupClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    request<T extends AirRequestDefaultArgs<ExtArgs> = {}>(args?: Subset<T, AirRequestDefaultArgs<ExtArgs>>): Prisma__AirRequestClient<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    items<T extends HawbGroup$itemsArgs<ExtArgs> = {}>(args?: Subset<T, HawbGroup$itemsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AirRequestItemPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the HawbGroup model
   */ 
  interface HawbGroupFieldRefs {
    readonly id: FieldRef<"HawbGroup", 'String'>
    readonly requestId: FieldRef<"HawbGroup", 'String'>
    readonly hawbNo: FieldRef<"HawbGroup", 'String'>
    readonly totalCharge: FieldRef<"HawbGroup", 'Float'>
    readonly createdAt: FieldRef<"HawbGroup", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * HawbGroup findUnique
   */
  export type HawbGroupFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HawbGroup
     */
    select?: HawbGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HawbGroupInclude<ExtArgs> | null
    /**
     * Filter, which HawbGroup to fetch.
     */
    where: HawbGroupWhereUniqueInput
  }

  /**
   * HawbGroup findUniqueOrThrow
   */
  export type HawbGroupFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HawbGroup
     */
    select?: HawbGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HawbGroupInclude<ExtArgs> | null
    /**
     * Filter, which HawbGroup to fetch.
     */
    where: HawbGroupWhereUniqueInput
  }

  /**
   * HawbGroup findFirst
   */
  export type HawbGroupFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HawbGroup
     */
    select?: HawbGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HawbGroupInclude<ExtArgs> | null
    /**
     * Filter, which HawbGroup to fetch.
     */
    where?: HawbGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HawbGroups to fetch.
     */
    orderBy?: HawbGroupOrderByWithRelationInput | HawbGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for HawbGroups.
     */
    cursor?: HawbGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HawbGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HawbGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of HawbGroups.
     */
    distinct?: HawbGroupScalarFieldEnum | HawbGroupScalarFieldEnum[]
  }

  /**
   * HawbGroup findFirstOrThrow
   */
  export type HawbGroupFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HawbGroup
     */
    select?: HawbGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HawbGroupInclude<ExtArgs> | null
    /**
     * Filter, which HawbGroup to fetch.
     */
    where?: HawbGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HawbGroups to fetch.
     */
    orderBy?: HawbGroupOrderByWithRelationInput | HawbGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for HawbGroups.
     */
    cursor?: HawbGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HawbGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HawbGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of HawbGroups.
     */
    distinct?: HawbGroupScalarFieldEnum | HawbGroupScalarFieldEnum[]
  }

  /**
   * HawbGroup findMany
   */
  export type HawbGroupFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HawbGroup
     */
    select?: HawbGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HawbGroupInclude<ExtArgs> | null
    /**
     * Filter, which HawbGroups to fetch.
     */
    where?: HawbGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HawbGroups to fetch.
     */
    orderBy?: HawbGroupOrderByWithRelationInput | HawbGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing HawbGroups.
     */
    cursor?: HawbGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HawbGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HawbGroups.
     */
    skip?: number
    distinct?: HawbGroupScalarFieldEnum | HawbGroupScalarFieldEnum[]
  }

  /**
   * HawbGroup create
   */
  export type HawbGroupCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HawbGroup
     */
    select?: HawbGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HawbGroupInclude<ExtArgs> | null
    /**
     * The data needed to create a HawbGroup.
     */
    data: XOR<HawbGroupCreateInput, HawbGroupUncheckedCreateInput>
  }

  /**
   * HawbGroup createMany
   */
  export type HawbGroupCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many HawbGroups.
     */
    data: HawbGroupCreateManyInput | HawbGroupCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * HawbGroup createManyAndReturn
   */
  export type HawbGroupCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HawbGroup
     */
    select?: HawbGroupSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many HawbGroups.
     */
    data: HawbGroupCreateManyInput | HawbGroupCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HawbGroupIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * HawbGroup update
   */
  export type HawbGroupUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HawbGroup
     */
    select?: HawbGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HawbGroupInclude<ExtArgs> | null
    /**
     * The data needed to update a HawbGroup.
     */
    data: XOR<HawbGroupUpdateInput, HawbGroupUncheckedUpdateInput>
    /**
     * Choose, which HawbGroup to update.
     */
    where: HawbGroupWhereUniqueInput
  }

  /**
   * HawbGroup updateMany
   */
  export type HawbGroupUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update HawbGroups.
     */
    data: XOR<HawbGroupUpdateManyMutationInput, HawbGroupUncheckedUpdateManyInput>
    /**
     * Filter which HawbGroups to update
     */
    where?: HawbGroupWhereInput
  }

  /**
   * HawbGroup upsert
   */
  export type HawbGroupUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HawbGroup
     */
    select?: HawbGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HawbGroupInclude<ExtArgs> | null
    /**
     * The filter to search for the HawbGroup to update in case it exists.
     */
    where: HawbGroupWhereUniqueInput
    /**
     * In case the HawbGroup found by the `where` argument doesn't exist, create a new HawbGroup with this data.
     */
    create: XOR<HawbGroupCreateInput, HawbGroupUncheckedCreateInput>
    /**
     * In case the HawbGroup was found with the provided `where` argument, update it with this data.
     */
    update: XOR<HawbGroupUpdateInput, HawbGroupUncheckedUpdateInput>
  }

  /**
   * HawbGroup delete
   */
  export type HawbGroupDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HawbGroup
     */
    select?: HawbGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HawbGroupInclude<ExtArgs> | null
    /**
     * Filter which HawbGroup to delete.
     */
    where: HawbGroupWhereUniqueInput
  }

  /**
   * HawbGroup deleteMany
   */
  export type HawbGroupDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which HawbGroups to delete
     */
    where?: HawbGroupWhereInput
  }

  /**
   * HawbGroup.items
   */
  export type HawbGroup$itemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestItem
     */
    select?: AirRequestItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestItemInclude<ExtArgs> | null
    where?: AirRequestItemWhereInput
    orderBy?: AirRequestItemOrderByWithRelationInput | AirRequestItemOrderByWithRelationInput[]
    cursor?: AirRequestItemWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AirRequestItemScalarFieldEnum | AirRequestItemScalarFieldEnum[]
  }

  /**
   * HawbGroup without action
   */
  export type HawbGroupDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HawbGroup
     */
    select?: HawbGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HawbGroupInclude<ExtArgs> | null
  }


  /**
   * Model AirRequestItem
   */

  export type AggregateAirRequestItem = {
    _count: AirRequestItemCountAggregateOutputType | null
    _avg: AirRequestItemAvgAggregateOutputType | null
    _sum: AirRequestItemSumAggregateOutputType | null
    _min: AirRequestItemMinAggregateOutputType | null
    _max: AirRequestItemMaxAggregateOutputType | null
  }

  export type AirRequestItemAvgAggregateOutputType = {
    qtyOriginalShipment: number | null
    qtyRequestAir: number | null
    grossWeight: number | null
    airFreight: number | null
    marketRatePerKg: number | null
    actualAirFreight: number | null
    claimPercentage: number | null
    qtyActualShip: number | null
  }

  export type AirRequestItemSumAggregateOutputType = {
    qtyOriginalShipment: number | null
    qtyRequestAir: number | null
    grossWeight: number | null
    airFreight: number | null
    marketRatePerKg: number | null
    actualAirFreight: number | null
    claimPercentage: number | null
    qtyActualShip: number | null
  }

  export type AirRequestItemMinAggregateOutputType = {
    id: string | null
    requestId: string | null
    hawbGroupId: string | null
    style: string | null
    so: string | null
    sub: string | null
    customerPO: string | null
    description: string | null
    gmtType: string | null
    originalShipmentDate: Date | null
    planShipmentDate: Date | null
    qtyOriginalShipment: number | null
    qtyRequestAir: number | null
    itemStatus: string | null
    itemComment: string | null
    reasonDelay: string | null
    factory: string | null
    country: string | null
    port: string | null
    grossWeight: number | null
    airFreight: number | null
    marketRatePerKg: number | null
    actualAirFreight: number | null
    claimDepartment: string | null
    invoiceNo: string | null
    hawbNo: string | null
    bookingDate: Date | null
    assignedDvm: string | null
    claimPercentage: number | null
    qtyActualShip: number | null
  }

  export type AirRequestItemMaxAggregateOutputType = {
    id: string | null
    requestId: string | null
    hawbGroupId: string | null
    style: string | null
    so: string | null
    sub: string | null
    customerPO: string | null
    description: string | null
    gmtType: string | null
    originalShipmentDate: Date | null
    planShipmentDate: Date | null
    qtyOriginalShipment: number | null
    qtyRequestAir: number | null
    itemStatus: string | null
    itemComment: string | null
    reasonDelay: string | null
    factory: string | null
    country: string | null
    port: string | null
    grossWeight: number | null
    airFreight: number | null
    marketRatePerKg: number | null
    actualAirFreight: number | null
    claimDepartment: string | null
    invoiceNo: string | null
    hawbNo: string | null
    bookingDate: Date | null
    assignedDvm: string | null
    claimPercentage: number | null
    qtyActualShip: number | null
  }

  export type AirRequestItemCountAggregateOutputType = {
    id: number
    requestId: number
    hawbGroupId: number
    style: number
    so: number
    sub: number
    customerPO: number
    description: number
    gmtType: number
    originalShipmentDate: number
    planShipmentDate: number
    qtyOriginalShipment: number
    qtyRequestAir: number
    itemStatus: number
    itemComment: number
    reasonDelay: number
    factory: number
    country: number
    port: number
    grossWeight: number
    airFreight: number
    marketRatePerKg: number
    actualAirFreight: number
    claimDepartment: number
    invoiceNo: number
    hawbNo: number
    bookingDate: number
    assignedDvm: number
    claimPercentage: number
    qtyActualShip: number
    _all: number
  }


  export type AirRequestItemAvgAggregateInputType = {
    qtyOriginalShipment?: true
    qtyRequestAir?: true
    grossWeight?: true
    airFreight?: true
    marketRatePerKg?: true
    actualAirFreight?: true
    claimPercentage?: true
    qtyActualShip?: true
  }

  export type AirRequestItemSumAggregateInputType = {
    qtyOriginalShipment?: true
    qtyRequestAir?: true
    grossWeight?: true
    airFreight?: true
    marketRatePerKg?: true
    actualAirFreight?: true
    claimPercentage?: true
    qtyActualShip?: true
  }

  export type AirRequestItemMinAggregateInputType = {
    id?: true
    requestId?: true
    hawbGroupId?: true
    style?: true
    so?: true
    sub?: true
    customerPO?: true
    description?: true
    gmtType?: true
    originalShipmentDate?: true
    planShipmentDate?: true
    qtyOriginalShipment?: true
    qtyRequestAir?: true
    itemStatus?: true
    itemComment?: true
    reasonDelay?: true
    factory?: true
    country?: true
    port?: true
    grossWeight?: true
    airFreight?: true
    marketRatePerKg?: true
    actualAirFreight?: true
    claimDepartment?: true
    invoiceNo?: true
    hawbNo?: true
    bookingDate?: true
    assignedDvm?: true
    claimPercentage?: true
    qtyActualShip?: true
  }

  export type AirRequestItemMaxAggregateInputType = {
    id?: true
    requestId?: true
    hawbGroupId?: true
    style?: true
    so?: true
    sub?: true
    customerPO?: true
    description?: true
    gmtType?: true
    originalShipmentDate?: true
    planShipmentDate?: true
    qtyOriginalShipment?: true
    qtyRequestAir?: true
    itemStatus?: true
    itemComment?: true
    reasonDelay?: true
    factory?: true
    country?: true
    port?: true
    grossWeight?: true
    airFreight?: true
    marketRatePerKg?: true
    actualAirFreight?: true
    claimDepartment?: true
    invoiceNo?: true
    hawbNo?: true
    bookingDate?: true
    assignedDvm?: true
    claimPercentage?: true
    qtyActualShip?: true
  }

  export type AirRequestItemCountAggregateInputType = {
    id?: true
    requestId?: true
    hawbGroupId?: true
    style?: true
    so?: true
    sub?: true
    customerPO?: true
    description?: true
    gmtType?: true
    originalShipmentDate?: true
    planShipmentDate?: true
    qtyOriginalShipment?: true
    qtyRequestAir?: true
    itemStatus?: true
    itemComment?: true
    reasonDelay?: true
    factory?: true
    country?: true
    port?: true
    grossWeight?: true
    airFreight?: true
    marketRatePerKg?: true
    actualAirFreight?: true
    claimDepartment?: true
    invoiceNo?: true
    hawbNo?: true
    bookingDate?: true
    assignedDvm?: true
    claimPercentage?: true
    qtyActualShip?: true
    _all?: true
  }

  export type AirRequestItemAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AirRequestItem to aggregate.
     */
    where?: AirRequestItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AirRequestItems to fetch.
     */
    orderBy?: AirRequestItemOrderByWithRelationInput | AirRequestItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AirRequestItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AirRequestItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AirRequestItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AirRequestItems
    **/
    _count?: true | AirRequestItemCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: AirRequestItemAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: AirRequestItemSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AirRequestItemMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AirRequestItemMaxAggregateInputType
  }

  export type GetAirRequestItemAggregateType<T extends AirRequestItemAggregateArgs> = {
        [P in keyof T & keyof AggregateAirRequestItem]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAirRequestItem[P]>
      : GetScalarType<T[P], AggregateAirRequestItem[P]>
  }




  export type AirRequestItemGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AirRequestItemWhereInput
    orderBy?: AirRequestItemOrderByWithAggregationInput | AirRequestItemOrderByWithAggregationInput[]
    by: AirRequestItemScalarFieldEnum[] | AirRequestItemScalarFieldEnum
    having?: AirRequestItemScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AirRequestItemCountAggregateInputType | true
    _avg?: AirRequestItemAvgAggregateInputType
    _sum?: AirRequestItemSumAggregateInputType
    _min?: AirRequestItemMinAggregateInputType
    _max?: AirRequestItemMaxAggregateInputType
  }

  export type AirRequestItemGroupByOutputType = {
    id: string
    requestId: string
    hawbGroupId: string | null
    style: string
    so: string
    sub: string | null
    customerPO: string | null
    description: string | null
    gmtType: string | null
    originalShipmentDate: Date | null
    planShipmentDate: Date | null
    qtyOriginalShipment: number
    qtyRequestAir: number
    itemStatus: string
    itemComment: string | null
    reasonDelay: string
    factory: string
    country: string
    port: string
    grossWeight: number | null
    airFreight: number | null
    marketRatePerKg: number | null
    actualAirFreight: number | null
    claimDepartment: string | null
    invoiceNo: string | null
    hawbNo: string | null
    bookingDate: Date | null
    assignedDvm: string | null
    claimPercentage: number | null
    qtyActualShip: number | null
    _count: AirRequestItemCountAggregateOutputType | null
    _avg: AirRequestItemAvgAggregateOutputType | null
    _sum: AirRequestItemSumAggregateOutputType | null
    _min: AirRequestItemMinAggregateOutputType | null
    _max: AirRequestItemMaxAggregateOutputType | null
  }

  type GetAirRequestItemGroupByPayload<T extends AirRequestItemGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AirRequestItemGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AirRequestItemGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AirRequestItemGroupByOutputType[P]>
            : GetScalarType<T[P], AirRequestItemGroupByOutputType[P]>
        }
      >
    >


  export type AirRequestItemSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    requestId?: boolean
    hawbGroupId?: boolean
    style?: boolean
    so?: boolean
    sub?: boolean
    customerPO?: boolean
    description?: boolean
    gmtType?: boolean
    originalShipmentDate?: boolean
    planShipmentDate?: boolean
    qtyOriginalShipment?: boolean
    qtyRequestAir?: boolean
    itemStatus?: boolean
    itemComment?: boolean
    reasonDelay?: boolean
    factory?: boolean
    country?: boolean
    port?: boolean
    grossWeight?: boolean
    airFreight?: boolean
    marketRatePerKg?: boolean
    actualAirFreight?: boolean
    claimDepartment?: boolean
    invoiceNo?: boolean
    hawbNo?: boolean
    bookingDate?: boolean
    assignedDvm?: boolean
    claimPercentage?: boolean
    qtyActualShip?: boolean
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
    hawbGroup?: boolean | AirRequestItem$hawbGroupArgs<ExtArgs>
    claimApprovals?: boolean | AirRequestItem$claimApprovalsArgs<ExtArgs>
    _count?: boolean | AirRequestItemCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["airRequestItem"]>

  export type AirRequestItemSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    requestId?: boolean
    hawbGroupId?: boolean
    style?: boolean
    so?: boolean
    sub?: boolean
    customerPO?: boolean
    description?: boolean
    gmtType?: boolean
    originalShipmentDate?: boolean
    planShipmentDate?: boolean
    qtyOriginalShipment?: boolean
    qtyRequestAir?: boolean
    itemStatus?: boolean
    itemComment?: boolean
    reasonDelay?: boolean
    factory?: boolean
    country?: boolean
    port?: boolean
    grossWeight?: boolean
    airFreight?: boolean
    marketRatePerKg?: boolean
    actualAirFreight?: boolean
    claimDepartment?: boolean
    invoiceNo?: boolean
    hawbNo?: boolean
    bookingDate?: boolean
    assignedDvm?: boolean
    claimPercentage?: boolean
    qtyActualShip?: boolean
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
    hawbGroup?: boolean | AirRequestItem$hawbGroupArgs<ExtArgs>
  }, ExtArgs["result"]["airRequestItem"]>

  export type AirRequestItemSelectScalar = {
    id?: boolean
    requestId?: boolean
    hawbGroupId?: boolean
    style?: boolean
    so?: boolean
    sub?: boolean
    customerPO?: boolean
    description?: boolean
    gmtType?: boolean
    originalShipmentDate?: boolean
    planShipmentDate?: boolean
    qtyOriginalShipment?: boolean
    qtyRequestAir?: boolean
    itemStatus?: boolean
    itemComment?: boolean
    reasonDelay?: boolean
    factory?: boolean
    country?: boolean
    port?: boolean
    grossWeight?: boolean
    airFreight?: boolean
    marketRatePerKg?: boolean
    actualAirFreight?: boolean
    claimDepartment?: boolean
    invoiceNo?: boolean
    hawbNo?: boolean
    bookingDate?: boolean
    assignedDvm?: boolean
    claimPercentage?: boolean
    qtyActualShip?: boolean
  }

  export type AirRequestItemInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
    hawbGroup?: boolean | AirRequestItem$hawbGroupArgs<ExtArgs>
    claimApprovals?: boolean | AirRequestItem$claimApprovalsArgs<ExtArgs>
    _count?: boolean | AirRequestItemCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type AirRequestItemIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
    hawbGroup?: boolean | AirRequestItem$hawbGroupArgs<ExtArgs>
  }

  export type $AirRequestItemPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AirRequestItem"
    objects: {
      request: Prisma.$AirRequestPayload<ExtArgs>
      hawbGroup: Prisma.$HawbGroupPayload<ExtArgs> | null
      claimApprovals: Prisma.$ClaimApprovalPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      requestId: string
      hawbGroupId: string | null
      style: string
      so: string
      sub: string | null
      customerPO: string | null
      description: string | null
      gmtType: string | null
      originalShipmentDate: Date | null
      planShipmentDate: Date | null
      qtyOriginalShipment: number
      qtyRequestAir: number
      itemStatus: string
      itemComment: string | null
      reasonDelay: string
      factory: string
      country: string
      port: string
      grossWeight: number | null
      airFreight: number | null
      marketRatePerKg: number | null
      actualAirFreight: number | null
      claimDepartment: string | null
      invoiceNo: string | null
      hawbNo: string | null
      bookingDate: Date | null
      assignedDvm: string | null
      claimPercentage: number | null
      qtyActualShip: number | null
    }, ExtArgs["result"]["airRequestItem"]>
    composites: {}
  }

  type AirRequestItemGetPayload<S extends boolean | null | undefined | AirRequestItemDefaultArgs> = $Result.GetResult<Prisma.$AirRequestItemPayload, S>

  type AirRequestItemCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<AirRequestItemFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: AirRequestItemCountAggregateInputType | true
    }

  export interface AirRequestItemDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AirRequestItem'], meta: { name: 'AirRequestItem' } }
    /**
     * Find zero or one AirRequestItem that matches the filter.
     * @param {AirRequestItemFindUniqueArgs} args - Arguments to find a AirRequestItem
     * @example
     * // Get one AirRequestItem
     * const airRequestItem = await prisma.airRequestItem.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AirRequestItemFindUniqueArgs>(args: SelectSubset<T, AirRequestItemFindUniqueArgs<ExtArgs>>): Prisma__AirRequestItemClient<$Result.GetResult<Prisma.$AirRequestItemPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one AirRequestItem that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {AirRequestItemFindUniqueOrThrowArgs} args - Arguments to find a AirRequestItem
     * @example
     * // Get one AirRequestItem
     * const airRequestItem = await prisma.airRequestItem.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AirRequestItemFindUniqueOrThrowArgs>(args: SelectSubset<T, AirRequestItemFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AirRequestItemClient<$Result.GetResult<Prisma.$AirRequestItemPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first AirRequestItem that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AirRequestItemFindFirstArgs} args - Arguments to find a AirRequestItem
     * @example
     * // Get one AirRequestItem
     * const airRequestItem = await prisma.airRequestItem.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AirRequestItemFindFirstArgs>(args?: SelectSubset<T, AirRequestItemFindFirstArgs<ExtArgs>>): Prisma__AirRequestItemClient<$Result.GetResult<Prisma.$AirRequestItemPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first AirRequestItem that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AirRequestItemFindFirstOrThrowArgs} args - Arguments to find a AirRequestItem
     * @example
     * // Get one AirRequestItem
     * const airRequestItem = await prisma.airRequestItem.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AirRequestItemFindFirstOrThrowArgs>(args?: SelectSubset<T, AirRequestItemFindFirstOrThrowArgs<ExtArgs>>): Prisma__AirRequestItemClient<$Result.GetResult<Prisma.$AirRequestItemPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more AirRequestItems that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AirRequestItemFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AirRequestItems
     * const airRequestItems = await prisma.airRequestItem.findMany()
     * 
     * // Get first 10 AirRequestItems
     * const airRequestItems = await prisma.airRequestItem.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const airRequestItemWithIdOnly = await prisma.airRequestItem.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AirRequestItemFindManyArgs>(args?: SelectSubset<T, AirRequestItemFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AirRequestItemPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a AirRequestItem.
     * @param {AirRequestItemCreateArgs} args - Arguments to create a AirRequestItem.
     * @example
     * // Create one AirRequestItem
     * const AirRequestItem = await prisma.airRequestItem.create({
     *   data: {
     *     // ... data to create a AirRequestItem
     *   }
     * })
     * 
     */
    create<T extends AirRequestItemCreateArgs>(args: SelectSubset<T, AirRequestItemCreateArgs<ExtArgs>>): Prisma__AirRequestItemClient<$Result.GetResult<Prisma.$AirRequestItemPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many AirRequestItems.
     * @param {AirRequestItemCreateManyArgs} args - Arguments to create many AirRequestItems.
     * @example
     * // Create many AirRequestItems
     * const airRequestItem = await prisma.airRequestItem.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AirRequestItemCreateManyArgs>(args?: SelectSubset<T, AirRequestItemCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AirRequestItems and returns the data saved in the database.
     * @param {AirRequestItemCreateManyAndReturnArgs} args - Arguments to create many AirRequestItems.
     * @example
     * // Create many AirRequestItems
     * const airRequestItem = await prisma.airRequestItem.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AirRequestItems and only return the `id`
     * const airRequestItemWithIdOnly = await prisma.airRequestItem.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AirRequestItemCreateManyAndReturnArgs>(args?: SelectSubset<T, AirRequestItemCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AirRequestItemPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a AirRequestItem.
     * @param {AirRequestItemDeleteArgs} args - Arguments to delete one AirRequestItem.
     * @example
     * // Delete one AirRequestItem
     * const AirRequestItem = await prisma.airRequestItem.delete({
     *   where: {
     *     // ... filter to delete one AirRequestItem
     *   }
     * })
     * 
     */
    delete<T extends AirRequestItemDeleteArgs>(args: SelectSubset<T, AirRequestItemDeleteArgs<ExtArgs>>): Prisma__AirRequestItemClient<$Result.GetResult<Prisma.$AirRequestItemPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one AirRequestItem.
     * @param {AirRequestItemUpdateArgs} args - Arguments to update one AirRequestItem.
     * @example
     * // Update one AirRequestItem
     * const airRequestItem = await prisma.airRequestItem.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AirRequestItemUpdateArgs>(args: SelectSubset<T, AirRequestItemUpdateArgs<ExtArgs>>): Prisma__AirRequestItemClient<$Result.GetResult<Prisma.$AirRequestItemPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more AirRequestItems.
     * @param {AirRequestItemDeleteManyArgs} args - Arguments to filter AirRequestItems to delete.
     * @example
     * // Delete a few AirRequestItems
     * const { count } = await prisma.airRequestItem.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AirRequestItemDeleteManyArgs>(args?: SelectSubset<T, AirRequestItemDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AirRequestItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AirRequestItemUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AirRequestItems
     * const airRequestItem = await prisma.airRequestItem.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AirRequestItemUpdateManyArgs>(args: SelectSubset<T, AirRequestItemUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one AirRequestItem.
     * @param {AirRequestItemUpsertArgs} args - Arguments to update or create a AirRequestItem.
     * @example
     * // Update or create a AirRequestItem
     * const airRequestItem = await prisma.airRequestItem.upsert({
     *   create: {
     *     // ... data to create a AirRequestItem
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AirRequestItem we want to update
     *   }
     * })
     */
    upsert<T extends AirRequestItemUpsertArgs>(args: SelectSubset<T, AirRequestItemUpsertArgs<ExtArgs>>): Prisma__AirRequestItemClient<$Result.GetResult<Prisma.$AirRequestItemPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of AirRequestItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AirRequestItemCountArgs} args - Arguments to filter AirRequestItems to count.
     * @example
     * // Count the number of AirRequestItems
     * const count = await prisma.airRequestItem.count({
     *   where: {
     *     // ... the filter for the AirRequestItems we want to count
     *   }
     * })
    **/
    count<T extends AirRequestItemCountArgs>(
      args?: Subset<T, AirRequestItemCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AirRequestItemCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AirRequestItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AirRequestItemAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AirRequestItemAggregateArgs>(args: Subset<T, AirRequestItemAggregateArgs>): Prisma.PrismaPromise<GetAirRequestItemAggregateType<T>>

    /**
     * Group by AirRequestItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AirRequestItemGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AirRequestItemGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AirRequestItemGroupByArgs['orderBy'] }
        : { orderBy?: AirRequestItemGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AirRequestItemGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAirRequestItemGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AirRequestItem model
   */
  readonly fields: AirRequestItemFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AirRequestItem.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AirRequestItemClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    request<T extends AirRequestDefaultArgs<ExtArgs> = {}>(args?: Subset<T, AirRequestDefaultArgs<ExtArgs>>): Prisma__AirRequestClient<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    hawbGroup<T extends AirRequestItem$hawbGroupArgs<ExtArgs> = {}>(args?: Subset<T, AirRequestItem$hawbGroupArgs<ExtArgs>>): Prisma__HawbGroupClient<$Result.GetResult<Prisma.$HawbGroupPayload<ExtArgs>, T, "findUniqueOrThrow"> | null, null, ExtArgs>
    claimApprovals<T extends AirRequestItem$claimApprovalsArgs<ExtArgs> = {}>(args?: Subset<T, AirRequestItem$claimApprovalsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClaimApprovalPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AirRequestItem model
   */ 
  interface AirRequestItemFieldRefs {
    readonly id: FieldRef<"AirRequestItem", 'String'>
    readonly requestId: FieldRef<"AirRequestItem", 'String'>
    readonly hawbGroupId: FieldRef<"AirRequestItem", 'String'>
    readonly style: FieldRef<"AirRequestItem", 'String'>
    readonly so: FieldRef<"AirRequestItem", 'String'>
    readonly sub: FieldRef<"AirRequestItem", 'String'>
    readonly customerPO: FieldRef<"AirRequestItem", 'String'>
    readonly description: FieldRef<"AirRequestItem", 'String'>
    readonly gmtType: FieldRef<"AirRequestItem", 'String'>
    readonly originalShipmentDate: FieldRef<"AirRequestItem", 'DateTime'>
    readonly planShipmentDate: FieldRef<"AirRequestItem", 'DateTime'>
    readonly qtyOriginalShipment: FieldRef<"AirRequestItem", 'Int'>
    readonly qtyRequestAir: FieldRef<"AirRequestItem", 'Int'>
    readonly itemStatus: FieldRef<"AirRequestItem", 'String'>
    readonly itemComment: FieldRef<"AirRequestItem", 'String'>
    readonly reasonDelay: FieldRef<"AirRequestItem", 'String'>
    readonly factory: FieldRef<"AirRequestItem", 'String'>
    readonly country: FieldRef<"AirRequestItem", 'String'>
    readonly port: FieldRef<"AirRequestItem", 'String'>
    readonly grossWeight: FieldRef<"AirRequestItem", 'Float'>
    readonly airFreight: FieldRef<"AirRequestItem", 'Float'>
    readonly marketRatePerKg: FieldRef<"AirRequestItem", 'Float'>
    readonly actualAirFreight: FieldRef<"AirRequestItem", 'Float'>
    readonly claimDepartment: FieldRef<"AirRequestItem", 'String'>
    readonly invoiceNo: FieldRef<"AirRequestItem", 'String'>
    readonly hawbNo: FieldRef<"AirRequestItem", 'String'>
    readonly bookingDate: FieldRef<"AirRequestItem", 'DateTime'>
    readonly assignedDvm: FieldRef<"AirRequestItem", 'String'>
    readonly claimPercentage: FieldRef<"AirRequestItem", 'Float'>
    readonly qtyActualShip: FieldRef<"AirRequestItem", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * AirRequestItem findUnique
   */
  export type AirRequestItemFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestItem
     */
    select?: AirRequestItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestItemInclude<ExtArgs> | null
    /**
     * Filter, which AirRequestItem to fetch.
     */
    where: AirRequestItemWhereUniqueInput
  }

  /**
   * AirRequestItem findUniqueOrThrow
   */
  export type AirRequestItemFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestItem
     */
    select?: AirRequestItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestItemInclude<ExtArgs> | null
    /**
     * Filter, which AirRequestItem to fetch.
     */
    where: AirRequestItemWhereUniqueInput
  }

  /**
   * AirRequestItem findFirst
   */
  export type AirRequestItemFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestItem
     */
    select?: AirRequestItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestItemInclude<ExtArgs> | null
    /**
     * Filter, which AirRequestItem to fetch.
     */
    where?: AirRequestItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AirRequestItems to fetch.
     */
    orderBy?: AirRequestItemOrderByWithRelationInput | AirRequestItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AirRequestItems.
     */
    cursor?: AirRequestItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AirRequestItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AirRequestItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AirRequestItems.
     */
    distinct?: AirRequestItemScalarFieldEnum | AirRequestItemScalarFieldEnum[]
  }

  /**
   * AirRequestItem findFirstOrThrow
   */
  export type AirRequestItemFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestItem
     */
    select?: AirRequestItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestItemInclude<ExtArgs> | null
    /**
     * Filter, which AirRequestItem to fetch.
     */
    where?: AirRequestItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AirRequestItems to fetch.
     */
    orderBy?: AirRequestItemOrderByWithRelationInput | AirRequestItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AirRequestItems.
     */
    cursor?: AirRequestItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AirRequestItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AirRequestItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AirRequestItems.
     */
    distinct?: AirRequestItemScalarFieldEnum | AirRequestItemScalarFieldEnum[]
  }

  /**
   * AirRequestItem findMany
   */
  export type AirRequestItemFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestItem
     */
    select?: AirRequestItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestItemInclude<ExtArgs> | null
    /**
     * Filter, which AirRequestItems to fetch.
     */
    where?: AirRequestItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AirRequestItems to fetch.
     */
    orderBy?: AirRequestItemOrderByWithRelationInput | AirRequestItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AirRequestItems.
     */
    cursor?: AirRequestItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AirRequestItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AirRequestItems.
     */
    skip?: number
    distinct?: AirRequestItemScalarFieldEnum | AirRequestItemScalarFieldEnum[]
  }

  /**
   * AirRequestItem create
   */
  export type AirRequestItemCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestItem
     */
    select?: AirRequestItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestItemInclude<ExtArgs> | null
    /**
     * The data needed to create a AirRequestItem.
     */
    data: XOR<AirRequestItemCreateInput, AirRequestItemUncheckedCreateInput>
  }

  /**
   * AirRequestItem createMany
   */
  export type AirRequestItemCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AirRequestItems.
     */
    data: AirRequestItemCreateManyInput | AirRequestItemCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AirRequestItem createManyAndReturn
   */
  export type AirRequestItemCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestItem
     */
    select?: AirRequestItemSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many AirRequestItems.
     */
    data: AirRequestItemCreateManyInput | AirRequestItemCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestItemIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * AirRequestItem update
   */
  export type AirRequestItemUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestItem
     */
    select?: AirRequestItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestItemInclude<ExtArgs> | null
    /**
     * The data needed to update a AirRequestItem.
     */
    data: XOR<AirRequestItemUpdateInput, AirRequestItemUncheckedUpdateInput>
    /**
     * Choose, which AirRequestItem to update.
     */
    where: AirRequestItemWhereUniqueInput
  }

  /**
   * AirRequestItem updateMany
   */
  export type AirRequestItemUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AirRequestItems.
     */
    data: XOR<AirRequestItemUpdateManyMutationInput, AirRequestItemUncheckedUpdateManyInput>
    /**
     * Filter which AirRequestItems to update
     */
    where?: AirRequestItemWhereInput
  }

  /**
   * AirRequestItem upsert
   */
  export type AirRequestItemUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestItem
     */
    select?: AirRequestItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestItemInclude<ExtArgs> | null
    /**
     * The filter to search for the AirRequestItem to update in case it exists.
     */
    where: AirRequestItemWhereUniqueInput
    /**
     * In case the AirRequestItem found by the `where` argument doesn't exist, create a new AirRequestItem with this data.
     */
    create: XOR<AirRequestItemCreateInput, AirRequestItemUncheckedCreateInput>
    /**
     * In case the AirRequestItem was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AirRequestItemUpdateInput, AirRequestItemUncheckedUpdateInput>
  }

  /**
   * AirRequestItem delete
   */
  export type AirRequestItemDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestItem
     */
    select?: AirRequestItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestItemInclude<ExtArgs> | null
    /**
     * Filter which AirRequestItem to delete.
     */
    where: AirRequestItemWhereUniqueInput
  }

  /**
   * AirRequestItem deleteMany
   */
  export type AirRequestItemDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AirRequestItems to delete
     */
    where?: AirRequestItemWhereInput
  }

  /**
   * AirRequestItem.hawbGroup
   */
  export type AirRequestItem$hawbGroupArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HawbGroup
     */
    select?: HawbGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HawbGroupInclude<ExtArgs> | null
    where?: HawbGroupWhereInput
  }

  /**
   * AirRequestItem.claimApprovals
   */
  export type AirRequestItem$claimApprovalsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClaimApproval
     */
    select?: ClaimApprovalSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClaimApprovalInclude<ExtArgs> | null
    where?: ClaimApprovalWhereInput
    orderBy?: ClaimApprovalOrderByWithRelationInput | ClaimApprovalOrderByWithRelationInput[]
    cursor?: ClaimApprovalWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ClaimApprovalScalarFieldEnum | ClaimApprovalScalarFieldEnum[]
  }

  /**
   * AirRequestItem without action
   */
  export type AirRequestItemDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AirRequestItem
     */
    select?: AirRequestItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AirRequestItemInclude<ExtArgs> | null
  }


  /**
   * Model ApprovalLog
   */

  export type AggregateApprovalLog = {
    _count: ApprovalLogCountAggregateOutputType | null
    _min: ApprovalLogMinAggregateOutputType | null
    _max: ApprovalLogMaxAggregateOutputType | null
  }

  export type ApprovalLogMinAggregateOutputType = {
    id: string | null
    requestId: string | null
    userId: string | null
    action: string | null
    fromStatus: string | null
    toStatus: string | null
    comment: string | null
    createdAt: Date | null
  }

  export type ApprovalLogMaxAggregateOutputType = {
    id: string | null
    requestId: string | null
    userId: string | null
    action: string | null
    fromStatus: string | null
    toStatus: string | null
    comment: string | null
    createdAt: Date | null
  }

  export type ApprovalLogCountAggregateOutputType = {
    id: number
    requestId: number
    userId: number
    action: number
    fromStatus: number
    toStatus: number
    comment: number
    createdAt: number
    _all: number
  }


  export type ApprovalLogMinAggregateInputType = {
    id?: true
    requestId?: true
    userId?: true
    action?: true
    fromStatus?: true
    toStatus?: true
    comment?: true
    createdAt?: true
  }

  export type ApprovalLogMaxAggregateInputType = {
    id?: true
    requestId?: true
    userId?: true
    action?: true
    fromStatus?: true
    toStatus?: true
    comment?: true
    createdAt?: true
  }

  export type ApprovalLogCountAggregateInputType = {
    id?: true
    requestId?: true
    userId?: true
    action?: true
    fromStatus?: true
    toStatus?: true
    comment?: true
    createdAt?: true
    _all?: true
  }

  export type ApprovalLogAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ApprovalLog to aggregate.
     */
    where?: ApprovalLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ApprovalLogs to fetch.
     */
    orderBy?: ApprovalLogOrderByWithRelationInput | ApprovalLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ApprovalLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ApprovalLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ApprovalLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ApprovalLogs
    **/
    _count?: true | ApprovalLogCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ApprovalLogMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ApprovalLogMaxAggregateInputType
  }

  export type GetApprovalLogAggregateType<T extends ApprovalLogAggregateArgs> = {
        [P in keyof T & keyof AggregateApprovalLog]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateApprovalLog[P]>
      : GetScalarType<T[P], AggregateApprovalLog[P]>
  }




  export type ApprovalLogGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ApprovalLogWhereInput
    orderBy?: ApprovalLogOrderByWithAggregationInput | ApprovalLogOrderByWithAggregationInput[]
    by: ApprovalLogScalarFieldEnum[] | ApprovalLogScalarFieldEnum
    having?: ApprovalLogScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ApprovalLogCountAggregateInputType | true
    _min?: ApprovalLogMinAggregateInputType
    _max?: ApprovalLogMaxAggregateInputType
  }

  export type ApprovalLogGroupByOutputType = {
    id: string
    requestId: string
    userId: string
    action: string
    fromStatus: string
    toStatus: string
    comment: string | null
    createdAt: Date
    _count: ApprovalLogCountAggregateOutputType | null
    _min: ApprovalLogMinAggregateOutputType | null
    _max: ApprovalLogMaxAggregateOutputType | null
  }

  type GetApprovalLogGroupByPayload<T extends ApprovalLogGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ApprovalLogGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ApprovalLogGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ApprovalLogGroupByOutputType[P]>
            : GetScalarType<T[P], ApprovalLogGroupByOutputType[P]>
        }
      >
    >


  export type ApprovalLogSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    requestId?: boolean
    userId?: boolean
    action?: boolean
    fromStatus?: boolean
    toStatus?: boolean
    comment?: boolean
    createdAt?: boolean
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["approvalLog"]>

  export type ApprovalLogSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    requestId?: boolean
    userId?: boolean
    action?: boolean
    fromStatus?: boolean
    toStatus?: boolean
    comment?: boolean
    createdAt?: boolean
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["approvalLog"]>

  export type ApprovalLogSelectScalar = {
    id?: boolean
    requestId?: boolean
    userId?: boolean
    action?: boolean
    fromStatus?: boolean
    toStatus?: boolean
    comment?: boolean
    createdAt?: boolean
  }

  export type ApprovalLogInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type ApprovalLogIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $ApprovalLogPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ApprovalLog"
    objects: {
      request: Prisma.$AirRequestPayload<ExtArgs>
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      requestId: string
      userId: string
      action: string
      fromStatus: string
      toStatus: string
      comment: string | null
      createdAt: Date
    }, ExtArgs["result"]["approvalLog"]>
    composites: {}
  }

  type ApprovalLogGetPayload<S extends boolean | null | undefined | ApprovalLogDefaultArgs> = $Result.GetResult<Prisma.$ApprovalLogPayload, S>

  type ApprovalLogCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ApprovalLogFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ApprovalLogCountAggregateInputType | true
    }

  export interface ApprovalLogDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ApprovalLog'], meta: { name: 'ApprovalLog' } }
    /**
     * Find zero or one ApprovalLog that matches the filter.
     * @param {ApprovalLogFindUniqueArgs} args - Arguments to find a ApprovalLog
     * @example
     * // Get one ApprovalLog
     * const approvalLog = await prisma.approvalLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ApprovalLogFindUniqueArgs>(args: SelectSubset<T, ApprovalLogFindUniqueArgs<ExtArgs>>): Prisma__ApprovalLogClient<$Result.GetResult<Prisma.$ApprovalLogPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one ApprovalLog that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ApprovalLogFindUniqueOrThrowArgs} args - Arguments to find a ApprovalLog
     * @example
     * // Get one ApprovalLog
     * const approvalLog = await prisma.approvalLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ApprovalLogFindUniqueOrThrowArgs>(args: SelectSubset<T, ApprovalLogFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ApprovalLogClient<$Result.GetResult<Prisma.$ApprovalLogPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first ApprovalLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ApprovalLogFindFirstArgs} args - Arguments to find a ApprovalLog
     * @example
     * // Get one ApprovalLog
     * const approvalLog = await prisma.approvalLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ApprovalLogFindFirstArgs>(args?: SelectSubset<T, ApprovalLogFindFirstArgs<ExtArgs>>): Prisma__ApprovalLogClient<$Result.GetResult<Prisma.$ApprovalLogPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first ApprovalLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ApprovalLogFindFirstOrThrowArgs} args - Arguments to find a ApprovalLog
     * @example
     * // Get one ApprovalLog
     * const approvalLog = await prisma.approvalLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ApprovalLogFindFirstOrThrowArgs>(args?: SelectSubset<T, ApprovalLogFindFirstOrThrowArgs<ExtArgs>>): Prisma__ApprovalLogClient<$Result.GetResult<Prisma.$ApprovalLogPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more ApprovalLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ApprovalLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ApprovalLogs
     * const approvalLogs = await prisma.approvalLog.findMany()
     * 
     * // Get first 10 ApprovalLogs
     * const approvalLogs = await prisma.approvalLog.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const approvalLogWithIdOnly = await prisma.approvalLog.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ApprovalLogFindManyArgs>(args?: SelectSubset<T, ApprovalLogFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ApprovalLogPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a ApprovalLog.
     * @param {ApprovalLogCreateArgs} args - Arguments to create a ApprovalLog.
     * @example
     * // Create one ApprovalLog
     * const ApprovalLog = await prisma.approvalLog.create({
     *   data: {
     *     // ... data to create a ApprovalLog
     *   }
     * })
     * 
     */
    create<T extends ApprovalLogCreateArgs>(args: SelectSubset<T, ApprovalLogCreateArgs<ExtArgs>>): Prisma__ApprovalLogClient<$Result.GetResult<Prisma.$ApprovalLogPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many ApprovalLogs.
     * @param {ApprovalLogCreateManyArgs} args - Arguments to create many ApprovalLogs.
     * @example
     * // Create many ApprovalLogs
     * const approvalLog = await prisma.approvalLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ApprovalLogCreateManyArgs>(args?: SelectSubset<T, ApprovalLogCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ApprovalLogs and returns the data saved in the database.
     * @param {ApprovalLogCreateManyAndReturnArgs} args - Arguments to create many ApprovalLogs.
     * @example
     * // Create many ApprovalLogs
     * const approvalLog = await prisma.approvalLog.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ApprovalLogs and only return the `id`
     * const approvalLogWithIdOnly = await prisma.approvalLog.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ApprovalLogCreateManyAndReturnArgs>(args?: SelectSubset<T, ApprovalLogCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ApprovalLogPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a ApprovalLog.
     * @param {ApprovalLogDeleteArgs} args - Arguments to delete one ApprovalLog.
     * @example
     * // Delete one ApprovalLog
     * const ApprovalLog = await prisma.approvalLog.delete({
     *   where: {
     *     // ... filter to delete one ApprovalLog
     *   }
     * })
     * 
     */
    delete<T extends ApprovalLogDeleteArgs>(args: SelectSubset<T, ApprovalLogDeleteArgs<ExtArgs>>): Prisma__ApprovalLogClient<$Result.GetResult<Prisma.$ApprovalLogPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one ApprovalLog.
     * @param {ApprovalLogUpdateArgs} args - Arguments to update one ApprovalLog.
     * @example
     * // Update one ApprovalLog
     * const approvalLog = await prisma.approvalLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ApprovalLogUpdateArgs>(args: SelectSubset<T, ApprovalLogUpdateArgs<ExtArgs>>): Prisma__ApprovalLogClient<$Result.GetResult<Prisma.$ApprovalLogPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more ApprovalLogs.
     * @param {ApprovalLogDeleteManyArgs} args - Arguments to filter ApprovalLogs to delete.
     * @example
     * // Delete a few ApprovalLogs
     * const { count } = await prisma.approvalLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ApprovalLogDeleteManyArgs>(args?: SelectSubset<T, ApprovalLogDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ApprovalLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ApprovalLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ApprovalLogs
     * const approvalLog = await prisma.approvalLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ApprovalLogUpdateManyArgs>(args: SelectSubset<T, ApprovalLogUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one ApprovalLog.
     * @param {ApprovalLogUpsertArgs} args - Arguments to update or create a ApprovalLog.
     * @example
     * // Update or create a ApprovalLog
     * const approvalLog = await prisma.approvalLog.upsert({
     *   create: {
     *     // ... data to create a ApprovalLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ApprovalLog we want to update
     *   }
     * })
     */
    upsert<T extends ApprovalLogUpsertArgs>(args: SelectSubset<T, ApprovalLogUpsertArgs<ExtArgs>>): Prisma__ApprovalLogClient<$Result.GetResult<Prisma.$ApprovalLogPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of ApprovalLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ApprovalLogCountArgs} args - Arguments to filter ApprovalLogs to count.
     * @example
     * // Count the number of ApprovalLogs
     * const count = await prisma.approvalLog.count({
     *   where: {
     *     // ... the filter for the ApprovalLogs we want to count
     *   }
     * })
    **/
    count<T extends ApprovalLogCountArgs>(
      args?: Subset<T, ApprovalLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ApprovalLogCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ApprovalLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ApprovalLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ApprovalLogAggregateArgs>(args: Subset<T, ApprovalLogAggregateArgs>): Prisma.PrismaPromise<GetApprovalLogAggregateType<T>>

    /**
     * Group by ApprovalLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ApprovalLogGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ApprovalLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ApprovalLogGroupByArgs['orderBy'] }
        : { orderBy?: ApprovalLogGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ApprovalLogGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetApprovalLogGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ApprovalLog model
   */
  readonly fields: ApprovalLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ApprovalLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ApprovalLogClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    request<T extends AirRequestDefaultArgs<ExtArgs> = {}>(args?: Subset<T, AirRequestDefaultArgs<ExtArgs>>): Prisma__AirRequestClient<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ApprovalLog model
   */ 
  interface ApprovalLogFieldRefs {
    readonly id: FieldRef<"ApprovalLog", 'String'>
    readonly requestId: FieldRef<"ApprovalLog", 'String'>
    readonly userId: FieldRef<"ApprovalLog", 'String'>
    readonly action: FieldRef<"ApprovalLog", 'String'>
    readonly fromStatus: FieldRef<"ApprovalLog", 'String'>
    readonly toStatus: FieldRef<"ApprovalLog", 'String'>
    readonly comment: FieldRef<"ApprovalLog", 'String'>
    readonly createdAt: FieldRef<"ApprovalLog", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ApprovalLog findUnique
   */
  export type ApprovalLogFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ApprovalLog
     */
    select?: ApprovalLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ApprovalLogInclude<ExtArgs> | null
    /**
     * Filter, which ApprovalLog to fetch.
     */
    where: ApprovalLogWhereUniqueInput
  }

  /**
   * ApprovalLog findUniqueOrThrow
   */
  export type ApprovalLogFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ApprovalLog
     */
    select?: ApprovalLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ApprovalLogInclude<ExtArgs> | null
    /**
     * Filter, which ApprovalLog to fetch.
     */
    where: ApprovalLogWhereUniqueInput
  }

  /**
   * ApprovalLog findFirst
   */
  export type ApprovalLogFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ApprovalLog
     */
    select?: ApprovalLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ApprovalLogInclude<ExtArgs> | null
    /**
     * Filter, which ApprovalLog to fetch.
     */
    where?: ApprovalLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ApprovalLogs to fetch.
     */
    orderBy?: ApprovalLogOrderByWithRelationInput | ApprovalLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ApprovalLogs.
     */
    cursor?: ApprovalLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ApprovalLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ApprovalLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ApprovalLogs.
     */
    distinct?: ApprovalLogScalarFieldEnum | ApprovalLogScalarFieldEnum[]
  }

  /**
   * ApprovalLog findFirstOrThrow
   */
  export type ApprovalLogFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ApprovalLog
     */
    select?: ApprovalLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ApprovalLogInclude<ExtArgs> | null
    /**
     * Filter, which ApprovalLog to fetch.
     */
    where?: ApprovalLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ApprovalLogs to fetch.
     */
    orderBy?: ApprovalLogOrderByWithRelationInput | ApprovalLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ApprovalLogs.
     */
    cursor?: ApprovalLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ApprovalLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ApprovalLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ApprovalLogs.
     */
    distinct?: ApprovalLogScalarFieldEnum | ApprovalLogScalarFieldEnum[]
  }

  /**
   * ApprovalLog findMany
   */
  export type ApprovalLogFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ApprovalLog
     */
    select?: ApprovalLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ApprovalLogInclude<ExtArgs> | null
    /**
     * Filter, which ApprovalLogs to fetch.
     */
    where?: ApprovalLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ApprovalLogs to fetch.
     */
    orderBy?: ApprovalLogOrderByWithRelationInput | ApprovalLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ApprovalLogs.
     */
    cursor?: ApprovalLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ApprovalLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ApprovalLogs.
     */
    skip?: number
    distinct?: ApprovalLogScalarFieldEnum | ApprovalLogScalarFieldEnum[]
  }

  /**
   * ApprovalLog create
   */
  export type ApprovalLogCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ApprovalLog
     */
    select?: ApprovalLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ApprovalLogInclude<ExtArgs> | null
    /**
     * The data needed to create a ApprovalLog.
     */
    data: XOR<ApprovalLogCreateInput, ApprovalLogUncheckedCreateInput>
  }

  /**
   * ApprovalLog createMany
   */
  export type ApprovalLogCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ApprovalLogs.
     */
    data: ApprovalLogCreateManyInput | ApprovalLogCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ApprovalLog createManyAndReturn
   */
  export type ApprovalLogCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ApprovalLog
     */
    select?: ApprovalLogSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many ApprovalLogs.
     */
    data: ApprovalLogCreateManyInput | ApprovalLogCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ApprovalLogIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ApprovalLog update
   */
  export type ApprovalLogUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ApprovalLog
     */
    select?: ApprovalLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ApprovalLogInclude<ExtArgs> | null
    /**
     * The data needed to update a ApprovalLog.
     */
    data: XOR<ApprovalLogUpdateInput, ApprovalLogUncheckedUpdateInput>
    /**
     * Choose, which ApprovalLog to update.
     */
    where: ApprovalLogWhereUniqueInput
  }

  /**
   * ApprovalLog updateMany
   */
  export type ApprovalLogUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ApprovalLogs.
     */
    data: XOR<ApprovalLogUpdateManyMutationInput, ApprovalLogUncheckedUpdateManyInput>
    /**
     * Filter which ApprovalLogs to update
     */
    where?: ApprovalLogWhereInput
  }

  /**
   * ApprovalLog upsert
   */
  export type ApprovalLogUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ApprovalLog
     */
    select?: ApprovalLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ApprovalLogInclude<ExtArgs> | null
    /**
     * The filter to search for the ApprovalLog to update in case it exists.
     */
    where: ApprovalLogWhereUniqueInput
    /**
     * In case the ApprovalLog found by the `where` argument doesn't exist, create a new ApprovalLog with this data.
     */
    create: XOR<ApprovalLogCreateInput, ApprovalLogUncheckedCreateInput>
    /**
     * In case the ApprovalLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ApprovalLogUpdateInput, ApprovalLogUncheckedUpdateInput>
  }

  /**
   * ApprovalLog delete
   */
  export type ApprovalLogDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ApprovalLog
     */
    select?: ApprovalLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ApprovalLogInclude<ExtArgs> | null
    /**
     * Filter which ApprovalLog to delete.
     */
    where: ApprovalLogWhereUniqueInput
  }

  /**
   * ApprovalLog deleteMany
   */
  export type ApprovalLogDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ApprovalLogs to delete
     */
    where?: ApprovalLogWhereInput
  }

  /**
   * ApprovalLog without action
   */
  export type ApprovalLogDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ApprovalLog
     */
    select?: ApprovalLogSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ApprovalLogInclude<ExtArgs> | null
  }


  /**
   * Model RequestAttachment
   */

  export type AggregateRequestAttachment = {
    _count: RequestAttachmentCountAggregateOutputType | null
    _avg: RequestAttachmentAvgAggregateOutputType | null
    _sum: RequestAttachmentSumAggregateOutputType | null
    _min: RequestAttachmentMinAggregateOutputType | null
    _max: RequestAttachmentMaxAggregateOutputType | null
  }

  export type RequestAttachmentAvgAggregateOutputType = {
    fileSize: number | null
  }

  export type RequestAttachmentSumAggregateOutputType = {
    fileSize: number | null
  }

  export type RequestAttachmentMinAggregateOutputType = {
    id: string | null
    requestId: string | null
    itemId: string | null
    uploadedById: string | null
    fileName: string | null
    filePath: string | null
    fileSize: number | null
    mimeType: string | null
    claimDept: string | null
    createdAt: Date | null
  }

  export type RequestAttachmentMaxAggregateOutputType = {
    id: string | null
    requestId: string | null
    itemId: string | null
    uploadedById: string | null
    fileName: string | null
    filePath: string | null
    fileSize: number | null
    mimeType: string | null
    claimDept: string | null
    createdAt: Date | null
  }

  export type RequestAttachmentCountAggregateOutputType = {
    id: number
    requestId: number
    itemId: number
    uploadedById: number
    fileName: number
    filePath: number
    fileSize: number
    mimeType: number
    claimDept: number
    createdAt: number
    _all: number
  }


  export type RequestAttachmentAvgAggregateInputType = {
    fileSize?: true
  }

  export type RequestAttachmentSumAggregateInputType = {
    fileSize?: true
  }

  export type RequestAttachmentMinAggregateInputType = {
    id?: true
    requestId?: true
    itemId?: true
    uploadedById?: true
    fileName?: true
    filePath?: true
    fileSize?: true
    mimeType?: true
    claimDept?: true
    createdAt?: true
  }

  export type RequestAttachmentMaxAggregateInputType = {
    id?: true
    requestId?: true
    itemId?: true
    uploadedById?: true
    fileName?: true
    filePath?: true
    fileSize?: true
    mimeType?: true
    claimDept?: true
    createdAt?: true
  }

  export type RequestAttachmentCountAggregateInputType = {
    id?: true
    requestId?: true
    itemId?: true
    uploadedById?: true
    fileName?: true
    filePath?: true
    fileSize?: true
    mimeType?: true
    claimDept?: true
    createdAt?: true
    _all?: true
  }

  export type RequestAttachmentAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RequestAttachment to aggregate.
     */
    where?: RequestAttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RequestAttachments to fetch.
     */
    orderBy?: RequestAttachmentOrderByWithRelationInput | RequestAttachmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: RequestAttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RequestAttachments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RequestAttachments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned RequestAttachments
    **/
    _count?: true | RequestAttachmentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: RequestAttachmentAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: RequestAttachmentSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: RequestAttachmentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: RequestAttachmentMaxAggregateInputType
  }

  export type GetRequestAttachmentAggregateType<T extends RequestAttachmentAggregateArgs> = {
        [P in keyof T & keyof AggregateRequestAttachment]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRequestAttachment[P]>
      : GetScalarType<T[P], AggregateRequestAttachment[P]>
  }




  export type RequestAttachmentGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RequestAttachmentWhereInput
    orderBy?: RequestAttachmentOrderByWithAggregationInput | RequestAttachmentOrderByWithAggregationInput[]
    by: RequestAttachmentScalarFieldEnum[] | RequestAttachmentScalarFieldEnum
    having?: RequestAttachmentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: RequestAttachmentCountAggregateInputType | true
    _avg?: RequestAttachmentAvgAggregateInputType
    _sum?: RequestAttachmentSumAggregateInputType
    _min?: RequestAttachmentMinAggregateInputType
    _max?: RequestAttachmentMaxAggregateInputType
  }

  export type RequestAttachmentGroupByOutputType = {
    id: string
    requestId: string
    itemId: string | null
    uploadedById: string
    fileName: string
    filePath: string
    fileSize: number
    mimeType: string
    claimDept: string | null
    createdAt: Date
    _count: RequestAttachmentCountAggregateOutputType | null
    _avg: RequestAttachmentAvgAggregateOutputType | null
    _sum: RequestAttachmentSumAggregateOutputType | null
    _min: RequestAttachmentMinAggregateOutputType | null
    _max: RequestAttachmentMaxAggregateOutputType | null
  }

  type GetRequestAttachmentGroupByPayload<T extends RequestAttachmentGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<RequestAttachmentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof RequestAttachmentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RequestAttachmentGroupByOutputType[P]>
            : GetScalarType<T[P], RequestAttachmentGroupByOutputType[P]>
        }
      >
    >


  export type RequestAttachmentSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    requestId?: boolean
    itemId?: boolean
    uploadedById?: boolean
    fileName?: boolean
    filePath?: boolean
    fileSize?: boolean
    mimeType?: boolean
    claimDept?: boolean
    createdAt?: boolean
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
    uploadedBy?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["requestAttachment"]>

  export type RequestAttachmentSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    requestId?: boolean
    itemId?: boolean
    uploadedById?: boolean
    fileName?: boolean
    filePath?: boolean
    fileSize?: boolean
    mimeType?: boolean
    claimDept?: boolean
    createdAt?: boolean
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
    uploadedBy?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["requestAttachment"]>

  export type RequestAttachmentSelectScalar = {
    id?: boolean
    requestId?: boolean
    itemId?: boolean
    uploadedById?: boolean
    fileName?: boolean
    filePath?: boolean
    fileSize?: boolean
    mimeType?: boolean
    claimDept?: boolean
    createdAt?: boolean
  }

  export type RequestAttachmentInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
    uploadedBy?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type RequestAttachmentIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    request?: boolean | AirRequestDefaultArgs<ExtArgs>
    uploadedBy?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $RequestAttachmentPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "RequestAttachment"
    objects: {
      request: Prisma.$AirRequestPayload<ExtArgs>
      uploadedBy: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      requestId: string
      itemId: string | null
      uploadedById: string
      fileName: string
      filePath: string
      fileSize: number
      mimeType: string
      claimDept: string | null
      createdAt: Date
    }, ExtArgs["result"]["requestAttachment"]>
    composites: {}
  }

  type RequestAttachmentGetPayload<S extends boolean | null | undefined | RequestAttachmentDefaultArgs> = $Result.GetResult<Prisma.$RequestAttachmentPayload, S>

  type RequestAttachmentCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<RequestAttachmentFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: RequestAttachmentCountAggregateInputType | true
    }

  export interface RequestAttachmentDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['RequestAttachment'], meta: { name: 'RequestAttachment' } }
    /**
     * Find zero or one RequestAttachment that matches the filter.
     * @param {RequestAttachmentFindUniqueArgs} args - Arguments to find a RequestAttachment
     * @example
     * // Get one RequestAttachment
     * const requestAttachment = await prisma.requestAttachment.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends RequestAttachmentFindUniqueArgs>(args: SelectSubset<T, RequestAttachmentFindUniqueArgs<ExtArgs>>): Prisma__RequestAttachmentClient<$Result.GetResult<Prisma.$RequestAttachmentPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one RequestAttachment that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {RequestAttachmentFindUniqueOrThrowArgs} args - Arguments to find a RequestAttachment
     * @example
     * // Get one RequestAttachment
     * const requestAttachment = await prisma.requestAttachment.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends RequestAttachmentFindUniqueOrThrowArgs>(args: SelectSubset<T, RequestAttachmentFindUniqueOrThrowArgs<ExtArgs>>): Prisma__RequestAttachmentClient<$Result.GetResult<Prisma.$RequestAttachmentPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first RequestAttachment that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RequestAttachmentFindFirstArgs} args - Arguments to find a RequestAttachment
     * @example
     * // Get one RequestAttachment
     * const requestAttachment = await prisma.requestAttachment.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends RequestAttachmentFindFirstArgs>(args?: SelectSubset<T, RequestAttachmentFindFirstArgs<ExtArgs>>): Prisma__RequestAttachmentClient<$Result.GetResult<Prisma.$RequestAttachmentPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first RequestAttachment that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RequestAttachmentFindFirstOrThrowArgs} args - Arguments to find a RequestAttachment
     * @example
     * // Get one RequestAttachment
     * const requestAttachment = await prisma.requestAttachment.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends RequestAttachmentFindFirstOrThrowArgs>(args?: SelectSubset<T, RequestAttachmentFindFirstOrThrowArgs<ExtArgs>>): Prisma__RequestAttachmentClient<$Result.GetResult<Prisma.$RequestAttachmentPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more RequestAttachments that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RequestAttachmentFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all RequestAttachments
     * const requestAttachments = await prisma.requestAttachment.findMany()
     * 
     * // Get first 10 RequestAttachments
     * const requestAttachments = await prisma.requestAttachment.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const requestAttachmentWithIdOnly = await prisma.requestAttachment.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends RequestAttachmentFindManyArgs>(args?: SelectSubset<T, RequestAttachmentFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RequestAttachmentPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a RequestAttachment.
     * @param {RequestAttachmentCreateArgs} args - Arguments to create a RequestAttachment.
     * @example
     * // Create one RequestAttachment
     * const RequestAttachment = await prisma.requestAttachment.create({
     *   data: {
     *     // ... data to create a RequestAttachment
     *   }
     * })
     * 
     */
    create<T extends RequestAttachmentCreateArgs>(args: SelectSubset<T, RequestAttachmentCreateArgs<ExtArgs>>): Prisma__RequestAttachmentClient<$Result.GetResult<Prisma.$RequestAttachmentPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many RequestAttachments.
     * @param {RequestAttachmentCreateManyArgs} args - Arguments to create many RequestAttachments.
     * @example
     * // Create many RequestAttachments
     * const requestAttachment = await prisma.requestAttachment.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends RequestAttachmentCreateManyArgs>(args?: SelectSubset<T, RequestAttachmentCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many RequestAttachments and returns the data saved in the database.
     * @param {RequestAttachmentCreateManyAndReturnArgs} args - Arguments to create many RequestAttachments.
     * @example
     * // Create many RequestAttachments
     * const requestAttachment = await prisma.requestAttachment.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many RequestAttachments and only return the `id`
     * const requestAttachmentWithIdOnly = await prisma.requestAttachment.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends RequestAttachmentCreateManyAndReturnArgs>(args?: SelectSubset<T, RequestAttachmentCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RequestAttachmentPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a RequestAttachment.
     * @param {RequestAttachmentDeleteArgs} args - Arguments to delete one RequestAttachment.
     * @example
     * // Delete one RequestAttachment
     * const RequestAttachment = await prisma.requestAttachment.delete({
     *   where: {
     *     // ... filter to delete one RequestAttachment
     *   }
     * })
     * 
     */
    delete<T extends RequestAttachmentDeleteArgs>(args: SelectSubset<T, RequestAttachmentDeleteArgs<ExtArgs>>): Prisma__RequestAttachmentClient<$Result.GetResult<Prisma.$RequestAttachmentPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one RequestAttachment.
     * @param {RequestAttachmentUpdateArgs} args - Arguments to update one RequestAttachment.
     * @example
     * // Update one RequestAttachment
     * const requestAttachment = await prisma.requestAttachment.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends RequestAttachmentUpdateArgs>(args: SelectSubset<T, RequestAttachmentUpdateArgs<ExtArgs>>): Prisma__RequestAttachmentClient<$Result.GetResult<Prisma.$RequestAttachmentPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more RequestAttachments.
     * @param {RequestAttachmentDeleteManyArgs} args - Arguments to filter RequestAttachments to delete.
     * @example
     * // Delete a few RequestAttachments
     * const { count } = await prisma.requestAttachment.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends RequestAttachmentDeleteManyArgs>(args?: SelectSubset<T, RequestAttachmentDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RequestAttachments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RequestAttachmentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many RequestAttachments
     * const requestAttachment = await prisma.requestAttachment.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends RequestAttachmentUpdateManyArgs>(args: SelectSubset<T, RequestAttachmentUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one RequestAttachment.
     * @param {RequestAttachmentUpsertArgs} args - Arguments to update or create a RequestAttachment.
     * @example
     * // Update or create a RequestAttachment
     * const requestAttachment = await prisma.requestAttachment.upsert({
     *   create: {
     *     // ... data to create a RequestAttachment
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the RequestAttachment we want to update
     *   }
     * })
     */
    upsert<T extends RequestAttachmentUpsertArgs>(args: SelectSubset<T, RequestAttachmentUpsertArgs<ExtArgs>>): Prisma__RequestAttachmentClient<$Result.GetResult<Prisma.$RequestAttachmentPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of RequestAttachments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RequestAttachmentCountArgs} args - Arguments to filter RequestAttachments to count.
     * @example
     * // Count the number of RequestAttachments
     * const count = await prisma.requestAttachment.count({
     *   where: {
     *     // ... the filter for the RequestAttachments we want to count
     *   }
     * })
    **/
    count<T extends RequestAttachmentCountArgs>(
      args?: Subset<T, RequestAttachmentCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RequestAttachmentCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a RequestAttachment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RequestAttachmentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends RequestAttachmentAggregateArgs>(args: Subset<T, RequestAttachmentAggregateArgs>): Prisma.PrismaPromise<GetRequestAttachmentAggregateType<T>>

    /**
     * Group by RequestAttachment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RequestAttachmentGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends RequestAttachmentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: RequestAttachmentGroupByArgs['orderBy'] }
        : { orderBy?: RequestAttachmentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, RequestAttachmentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRequestAttachmentGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the RequestAttachment model
   */
  readonly fields: RequestAttachmentFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for RequestAttachment.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__RequestAttachmentClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    request<T extends AirRequestDefaultArgs<ExtArgs> = {}>(args?: Subset<T, AirRequestDefaultArgs<ExtArgs>>): Prisma__AirRequestClient<$Result.GetResult<Prisma.$AirRequestPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    uploadedBy<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the RequestAttachment model
   */ 
  interface RequestAttachmentFieldRefs {
    readonly id: FieldRef<"RequestAttachment", 'String'>
    readonly requestId: FieldRef<"RequestAttachment", 'String'>
    readonly itemId: FieldRef<"RequestAttachment", 'String'>
    readonly uploadedById: FieldRef<"RequestAttachment", 'String'>
    readonly fileName: FieldRef<"RequestAttachment", 'String'>
    readonly filePath: FieldRef<"RequestAttachment", 'String'>
    readonly fileSize: FieldRef<"RequestAttachment", 'Int'>
    readonly mimeType: FieldRef<"RequestAttachment", 'String'>
    readonly claimDept: FieldRef<"RequestAttachment", 'String'>
    readonly createdAt: FieldRef<"RequestAttachment", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * RequestAttachment findUnique
   */
  export type RequestAttachmentFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RequestAttachment
     */
    select?: RequestAttachmentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RequestAttachmentInclude<ExtArgs> | null
    /**
     * Filter, which RequestAttachment to fetch.
     */
    where: RequestAttachmentWhereUniqueInput
  }

  /**
   * RequestAttachment findUniqueOrThrow
   */
  export type RequestAttachmentFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RequestAttachment
     */
    select?: RequestAttachmentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RequestAttachmentInclude<ExtArgs> | null
    /**
     * Filter, which RequestAttachment to fetch.
     */
    where: RequestAttachmentWhereUniqueInput
  }

  /**
   * RequestAttachment findFirst
   */
  export type RequestAttachmentFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RequestAttachment
     */
    select?: RequestAttachmentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RequestAttachmentInclude<ExtArgs> | null
    /**
     * Filter, which RequestAttachment to fetch.
     */
    where?: RequestAttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RequestAttachments to fetch.
     */
    orderBy?: RequestAttachmentOrderByWithRelationInput | RequestAttachmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RequestAttachments.
     */
    cursor?: RequestAttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RequestAttachments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RequestAttachments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RequestAttachments.
     */
    distinct?: RequestAttachmentScalarFieldEnum | RequestAttachmentScalarFieldEnum[]
  }

  /**
   * RequestAttachment findFirstOrThrow
   */
  export type RequestAttachmentFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RequestAttachment
     */
    select?: RequestAttachmentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RequestAttachmentInclude<ExtArgs> | null
    /**
     * Filter, which RequestAttachment to fetch.
     */
    where?: RequestAttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RequestAttachments to fetch.
     */
    orderBy?: RequestAttachmentOrderByWithRelationInput | RequestAttachmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RequestAttachments.
     */
    cursor?: RequestAttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RequestAttachments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RequestAttachments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RequestAttachments.
     */
    distinct?: RequestAttachmentScalarFieldEnum | RequestAttachmentScalarFieldEnum[]
  }

  /**
   * RequestAttachment findMany
   */
  export type RequestAttachmentFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RequestAttachment
     */
    select?: RequestAttachmentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RequestAttachmentInclude<ExtArgs> | null
    /**
     * Filter, which RequestAttachments to fetch.
     */
    where?: RequestAttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RequestAttachments to fetch.
     */
    orderBy?: RequestAttachmentOrderByWithRelationInput | RequestAttachmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing RequestAttachments.
     */
    cursor?: RequestAttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RequestAttachments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RequestAttachments.
     */
    skip?: number
    distinct?: RequestAttachmentScalarFieldEnum | RequestAttachmentScalarFieldEnum[]
  }

  /**
   * RequestAttachment create
   */
  export type RequestAttachmentCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RequestAttachment
     */
    select?: RequestAttachmentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RequestAttachmentInclude<ExtArgs> | null
    /**
     * The data needed to create a RequestAttachment.
     */
    data: XOR<RequestAttachmentCreateInput, RequestAttachmentUncheckedCreateInput>
  }

  /**
   * RequestAttachment createMany
   */
  export type RequestAttachmentCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many RequestAttachments.
     */
    data: RequestAttachmentCreateManyInput | RequestAttachmentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RequestAttachment createManyAndReturn
   */
  export type RequestAttachmentCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RequestAttachment
     */
    select?: RequestAttachmentSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many RequestAttachments.
     */
    data: RequestAttachmentCreateManyInput | RequestAttachmentCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RequestAttachmentIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * RequestAttachment update
   */
  export type RequestAttachmentUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RequestAttachment
     */
    select?: RequestAttachmentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RequestAttachmentInclude<ExtArgs> | null
    /**
     * The data needed to update a RequestAttachment.
     */
    data: XOR<RequestAttachmentUpdateInput, RequestAttachmentUncheckedUpdateInput>
    /**
     * Choose, which RequestAttachment to update.
     */
    where: RequestAttachmentWhereUniqueInput
  }

  /**
   * RequestAttachment updateMany
   */
  export type RequestAttachmentUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update RequestAttachments.
     */
    data: XOR<RequestAttachmentUpdateManyMutationInput, RequestAttachmentUncheckedUpdateManyInput>
    /**
     * Filter which RequestAttachments to update
     */
    where?: RequestAttachmentWhereInput
  }

  /**
   * RequestAttachment upsert
   */
  export type RequestAttachmentUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RequestAttachment
     */
    select?: RequestAttachmentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RequestAttachmentInclude<ExtArgs> | null
    /**
     * The filter to search for the RequestAttachment to update in case it exists.
     */
    where: RequestAttachmentWhereUniqueInput
    /**
     * In case the RequestAttachment found by the `where` argument doesn't exist, create a new RequestAttachment with this data.
     */
    create: XOR<RequestAttachmentCreateInput, RequestAttachmentUncheckedCreateInput>
    /**
     * In case the RequestAttachment was found with the provided `where` argument, update it with this data.
     */
    update: XOR<RequestAttachmentUpdateInput, RequestAttachmentUncheckedUpdateInput>
  }

  /**
   * RequestAttachment delete
   */
  export type RequestAttachmentDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RequestAttachment
     */
    select?: RequestAttachmentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RequestAttachmentInclude<ExtArgs> | null
    /**
     * Filter which RequestAttachment to delete.
     */
    where: RequestAttachmentWhereUniqueInput
  }

  /**
   * RequestAttachment deleteMany
   */
  export type RequestAttachmentDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RequestAttachments to delete
     */
    where?: RequestAttachmentWhereInput
  }

  /**
   * RequestAttachment without action
   */
  export type RequestAttachmentDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RequestAttachment
     */
    select?: RequestAttachmentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RequestAttachmentInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    name: 'name',
    email: 'email',
    password: 'password',
    role: 'role',
    claimDepartment: 'claimDepartment',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    priority: 'priority',
    bu: 'bu',
    procurementType: 'procurementType',
    resetToken: 'resetToken',
    resetTokenExpiry: 'resetTokenExpiry'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const MasterBrandScalarFieldEnum: {
    id: 'id',
    name: 'name',
    isActive: 'isActive'
  };

  export type MasterBrandScalarFieldEnum = (typeof MasterBrandScalarFieldEnum)[keyof typeof MasterBrandScalarFieldEnum]


  export const MasterBUScalarFieldEnum: {
    id: 'id',
    name: 'name',
    isActive: 'isActive'
  };

  export type MasterBUScalarFieldEnum = (typeof MasterBUScalarFieldEnum)[keyof typeof MasterBUScalarFieldEnum]


  export const MasterDescriptionScalarFieldEnum: {
    id: 'id',
    name: 'name',
    weightPerUnit: 'weightPerUnit',
    isActive: 'isActive'
  };

  export type MasterDescriptionScalarFieldEnum = (typeof MasterDescriptionScalarFieldEnum)[keyof typeof MasterDescriptionScalarFieldEnum]


  export const MasterGMTTypeScalarFieldEnum: {
    id: 'id',
    name: 'name',
    isActive: 'isActive'
  };

  export type MasterGMTTypeScalarFieldEnum = (typeof MasterGMTTypeScalarFieldEnum)[keyof typeof MasterGMTTypeScalarFieldEnum]


  export const MasterPortScalarFieldEnum: {
    id: 'id',
    country: 'country',
    port: 'port',
    ratePerKg: 'ratePerKg',
    isActive: 'isActive',
    updatedAt: 'updatedAt'
  };

  export type MasterPortScalarFieldEnum = (typeof MasterPortScalarFieldEnum)[keyof typeof MasterPortScalarFieldEnum]


  export const AirRequestScalarFieldEnum: {
    id: 'id',
    documentNo: 'documentNo',
    brandName: 'brandName',
    buName: 'buName',
    status: 'status',
    claimDepartment: 'claimDepartment',
    rejectionReason: 'rejectionReason',
    createdById: 'createdById',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    invoiceNo: 'invoiceNo',
    actualAirFreight: 'actualAirFreight',
    bookingDate: 'bookingDate',
    airline: 'airline',
    assignedVpMer: 'assignedVpMer',
    vpMerToken: 'vpMerToken',
    presidentToken: 'presidentToken',
    scmToken: 'scmToken',
    vpScmToken: 'vpScmToken',
    assignedVpScm: 'assignedVpScm',
    logisticsToken: 'logisticsToken',
    accountingToken: 'accountingToken',
    claimNextEmail: 'claimNextEmail',
    claimNextToken: 'claimNextToken',
    claimNextName: 'claimNextName',
    bu: 'bu'
  };

  export type AirRequestScalarFieldEnum = (typeof AirRequestScalarFieldEnum)[keyof typeof AirRequestScalarFieldEnum]


  export const ClaimApprovalScalarFieldEnum: {
    id: 'id',
    itemId: 'itemId',
    userId: 'userId',
    role: 'role',
    createdAt: 'createdAt'
  };

  export type ClaimApprovalScalarFieldEnum = (typeof ClaimApprovalScalarFieldEnum)[keyof typeof ClaimApprovalScalarFieldEnum]


  export const HawbGroupScalarFieldEnum: {
    id: 'id',
    requestId: 'requestId',
    hawbNo: 'hawbNo',
    totalCharge: 'totalCharge',
    createdAt: 'createdAt'
  };

  export type HawbGroupScalarFieldEnum = (typeof HawbGroupScalarFieldEnum)[keyof typeof HawbGroupScalarFieldEnum]


  export const AirRequestItemScalarFieldEnum: {
    id: 'id',
    requestId: 'requestId',
    hawbGroupId: 'hawbGroupId',
    style: 'style',
    so: 'so',
    sub: 'sub',
    customerPO: 'customerPO',
    description: 'description',
    gmtType: 'gmtType',
    originalShipmentDate: 'originalShipmentDate',
    planShipmentDate: 'planShipmentDate',
    qtyOriginalShipment: 'qtyOriginalShipment',
    qtyRequestAir: 'qtyRequestAir',
    itemStatus: 'itemStatus',
    itemComment: 'itemComment',
    reasonDelay: 'reasonDelay',
    factory: 'factory',
    country: 'country',
    port: 'port',
    grossWeight: 'grossWeight',
    airFreight: 'airFreight',
    marketRatePerKg: 'marketRatePerKg',
    actualAirFreight: 'actualAirFreight',
    claimDepartment: 'claimDepartment',
    invoiceNo: 'invoiceNo',
    hawbNo: 'hawbNo',
    bookingDate: 'bookingDate',
    assignedDvm: 'assignedDvm',
    claimPercentage: 'claimPercentage',
    qtyActualShip: 'qtyActualShip'
  };

  export type AirRequestItemScalarFieldEnum = (typeof AirRequestItemScalarFieldEnum)[keyof typeof AirRequestItemScalarFieldEnum]


  export const ApprovalLogScalarFieldEnum: {
    id: 'id',
    requestId: 'requestId',
    userId: 'userId',
    action: 'action',
    fromStatus: 'fromStatus',
    toStatus: 'toStatus',
    comment: 'comment',
    createdAt: 'createdAt'
  };

  export type ApprovalLogScalarFieldEnum = (typeof ApprovalLogScalarFieldEnum)[keyof typeof ApprovalLogScalarFieldEnum]


  export const RequestAttachmentScalarFieldEnum: {
    id: 'id',
    requestId: 'requestId',
    itemId: 'itemId',
    uploadedById: 'uploadedById',
    fileName: 'fileName',
    filePath: 'filePath',
    fileSize: 'fileSize',
    mimeType: 'mimeType',
    claimDept: 'claimDept',
    createdAt: 'createdAt'
  };

  export type RequestAttachmentScalarFieldEnum = (typeof RequestAttachmentScalarFieldEnum)[keyof typeof RequestAttachmentScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references 
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    name?: StringNullableFilter<"User"> | string | null
    email?: StringFilter<"User"> | string
    password?: StringNullableFilter<"User"> | string | null
    role?: StringFilter<"User"> | string
    claimDepartment?: StringNullableFilter<"User"> | string | null
    isActive?: BoolFilter<"User"> | boolean
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    priority?: IntNullableFilter<"User"> | number | null
    bu?: StringFilter<"User"> | string
    procurementType?: StringNullableFilter<"User"> | string | null
    resetToken?: StringNullableFilter<"User"> | string | null
    resetTokenExpiry?: DateTimeNullableFilter<"User"> | Date | string | null
    airRequests?: AirRequestListRelationFilter
    approvals?: ApprovalLogListRelationFilter
    claimApprovals?: ClaimApprovalListRelationFilter
    attachments?: RequestAttachmentListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrderInput | SortOrder
    email?: SortOrder
    password?: SortOrderInput | SortOrder
    role?: SortOrder
    claimDepartment?: SortOrderInput | SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    priority?: SortOrderInput | SortOrder
    bu?: SortOrder
    procurementType?: SortOrderInput | SortOrder
    resetToken?: SortOrderInput | SortOrder
    resetTokenExpiry?: SortOrderInput | SortOrder
    airRequests?: AirRequestOrderByRelationAggregateInput
    approvals?: ApprovalLogOrderByRelationAggregateInput
    claimApprovals?: ClaimApprovalOrderByRelationAggregateInput
    attachments?: RequestAttachmentOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    resetToken?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    name?: StringNullableFilter<"User"> | string | null
    password?: StringNullableFilter<"User"> | string | null
    role?: StringFilter<"User"> | string
    claimDepartment?: StringNullableFilter<"User"> | string | null
    isActive?: BoolFilter<"User"> | boolean
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    priority?: IntNullableFilter<"User"> | number | null
    bu?: StringFilter<"User"> | string
    procurementType?: StringNullableFilter<"User"> | string | null
    resetTokenExpiry?: DateTimeNullableFilter<"User"> | Date | string | null
    airRequests?: AirRequestListRelationFilter
    approvals?: ApprovalLogListRelationFilter
    claimApprovals?: ClaimApprovalListRelationFilter
    attachments?: RequestAttachmentListRelationFilter
  }, "id" | "email" | "resetToken">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrderInput | SortOrder
    email?: SortOrder
    password?: SortOrderInput | SortOrder
    role?: SortOrder
    claimDepartment?: SortOrderInput | SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    priority?: SortOrderInput | SortOrder
    bu?: SortOrder
    procurementType?: SortOrderInput | SortOrder
    resetToken?: SortOrderInput | SortOrder
    resetTokenExpiry?: SortOrderInput | SortOrder
    _count?: UserCountOrderByAggregateInput
    _avg?: UserAvgOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
    _sum?: UserSumOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    name?: StringNullableWithAggregatesFilter<"User"> | string | null
    email?: StringWithAggregatesFilter<"User"> | string
    password?: StringNullableWithAggregatesFilter<"User"> | string | null
    role?: StringWithAggregatesFilter<"User"> | string
    claimDepartment?: StringNullableWithAggregatesFilter<"User"> | string | null
    isActive?: BoolWithAggregatesFilter<"User"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    priority?: IntNullableWithAggregatesFilter<"User"> | number | null
    bu?: StringWithAggregatesFilter<"User"> | string
    procurementType?: StringNullableWithAggregatesFilter<"User"> | string | null
    resetToken?: StringNullableWithAggregatesFilter<"User"> | string | null
    resetTokenExpiry?: DateTimeNullableWithAggregatesFilter<"User"> | Date | string | null
  }

  export type MasterBrandWhereInput = {
    AND?: MasterBrandWhereInput | MasterBrandWhereInput[]
    OR?: MasterBrandWhereInput[]
    NOT?: MasterBrandWhereInput | MasterBrandWhereInput[]
    id?: StringFilter<"MasterBrand"> | string
    name?: StringFilter<"MasterBrand"> | string
    isActive?: BoolFilter<"MasterBrand"> | boolean
  }

  export type MasterBrandOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
  }

  export type MasterBrandWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    name?: string
    AND?: MasterBrandWhereInput | MasterBrandWhereInput[]
    OR?: MasterBrandWhereInput[]
    NOT?: MasterBrandWhereInput | MasterBrandWhereInput[]
    isActive?: BoolFilter<"MasterBrand"> | boolean
  }, "id" | "name">

  export type MasterBrandOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
    _count?: MasterBrandCountOrderByAggregateInput
    _max?: MasterBrandMaxOrderByAggregateInput
    _min?: MasterBrandMinOrderByAggregateInput
  }

  export type MasterBrandScalarWhereWithAggregatesInput = {
    AND?: MasterBrandScalarWhereWithAggregatesInput | MasterBrandScalarWhereWithAggregatesInput[]
    OR?: MasterBrandScalarWhereWithAggregatesInput[]
    NOT?: MasterBrandScalarWhereWithAggregatesInput | MasterBrandScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"MasterBrand"> | string
    name?: StringWithAggregatesFilter<"MasterBrand"> | string
    isActive?: BoolWithAggregatesFilter<"MasterBrand"> | boolean
  }

  export type MasterBUWhereInput = {
    AND?: MasterBUWhereInput | MasterBUWhereInput[]
    OR?: MasterBUWhereInput[]
    NOT?: MasterBUWhereInput | MasterBUWhereInput[]
    id?: StringFilter<"MasterBU"> | string
    name?: StringFilter<"MasterBU"> | string
    isActive?: BoolFilter<"MasterBU"> | boolean
  }

  export type MasterBUOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
  }

  export type MasterBUWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    name?: string
    AND?: MasterBUWhereInput | MasterBUWhereInput[]
    OR?: MasterBUWhereInput[]
    NOT?: MasterBUWhereInput | MasterBUWhereInput[]
    isActive?: BoolFilter<"MasterBU"> | boolean
  }, "id" | "name">

  export type MasterBUOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
    _count?: MasterBUCountOrderByAggregateInput
    _max?: MasterBUMaxOrderByAggregateInput
    _min?: MasterBUMinOrderByAggregateInput
  }

  export type MasterBUScalarWhereWithAggregatesInput = {
    AND?: MasterBUScalarWhereWithAggregatesInput | MasterBUScalarWhereWithAggregatesInput[]
    OR?: MasterBUScalarWhereWithAggregatesInput[]
    NOT?: MasterBUScalarWhereWithAggregatesInput | MasterBUScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"MasterBU"> | string
    name?: StringWithAggregatesFilter<"MasterBU"> | string
    isActive?: BoolWithAggregatesFilter<"MasterBU"> | boolean
  }

  export type MasterDescriptionWhereInput = {
    AND?: MasterDescriptionWhereInput | MasterDescriptionWhereInput[]
    OR?: MasterDescriptionWhereInput[]
    NOT?: MasterDescriptionWhereInput | MasterDescriptionWhereInput[]
    id?: StringFilter<"MasterDescription"> | string
    name?: StringFilter<"MasterDescription"> | string
    weightPerUnit?: FloatFilter<"MasterDescription"> | number
    isActive?: BoolFilter<"MasterDescription"> | boolean
  }

  export type MasterDescriptionOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    weightPerUnit?: SortOrder
    isActive?: SortOrder
  }

  export type MasterDescriptionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    name?: string
    AND?: MasterDescriptionWhereInput | MasterDescriptionWhereInput[]
    OR?: MasterDescriptionWhereInput[]
    NOT?: MasterDescriptionWhereInput | MasterDescriptionWhereInput[]
    weightPerUnit?: FloatFilter<"MasterDescription"> | number
    isActive?: BoolFilter<"MasterDescription"> | boolean
  }, "id" | "name">

  export type MasterDescriptionOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    weightPerUnit?: SortOrder
    isActive?: SortOrder
    _count?: MasterDescriptionCountOrderByAggregateInput
    _avg?: MasterDescriptionAvgOrderByAggregateInput
    _max?: MasterDescriptionMaxOrderByAggregateInput
    _min?: MasterDescriptionMinOrderByAggregateInput
    _sum?: MasterDescriptionSumOrderByAggregateInput
  }

  export type MasterDescriptionScalarWhereWithAggregatesInput = {
    AND?: MasterDescriptionScalarWhereWithAggregatesInput | MasterDescriptionScalarWhereWithAggregatesInput[]
    OR?: MasterDescriptionScalarWhereWithAggregatesInput[]
    NOT?: MasterDescriptionScalarWhereWithAggregatesInput | MasterDescriptionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"MasterDescription"> | string
    name?: StringWithAggregatesFilter<"MasterDescription"> | string
    weightPerUnit?: FloatWithAggregatesFilter<"MasterDescription"> | number
    isActive?: BoolWithAggregatesFilter<"MasterDescription"> | boolean
  }

  export type MasterGMTTypeWhereInput = {
    AND?: MasterGMTTypeWhereInput | MasterGMTTypeWhereInput[]
    OR?: MasterGMTTypeWhereInput[]
    NOT?: MasterGMTTypeWhereInput | MasterGMTTypeWhereInput[]
    id?: StringFilter<"MasterGMTType"> | string
    name?: StringFilter<"MasterGMTType"> | string
    isActive?: BoolFilter<"MasterGMTType"> | boolean
  }

  export type MasterGMTTypeOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
  }

  export type MasterGMTTypeWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    name?: string
    AND?: MasterGMTTypeWhereInput | MasterGMTTypeWhereInput[]
    OR?: MasterGMTTypeWhereInput[]
    NOT?: MasterGMTTypeWhereInput | MasterGMTTypeWhereInput[]
    isActive?: BoolFilter<"MasterGMTType"> | boolean
  }, "id" | "name">

  export type MasterGMTTypeOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
    _count?: MasterGMTTypeCountOrderByAggregateInput
    _max?: MasterGMTTypeMaxOrderByAggregateInput
    _min?: MasterGMTTypeMinOrderByAggregateInput
  }

  export type MasterGMTTypeScalarWhereWithAggregatesInput = {
    AND?: MasterGMTTypeScalarWhereWithAggregatesInput | MasterGMTTypeScalarWhereWithAggregatesInput[]
    OR?: MasterGMTTypeScalarWhereWithAggregatesInput[]
    NOT?: MasterGMTTypeScalarWhereWithAggregatesInput | MasterGMTTypeScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"MasterGMTType"> | string
    name?: StringWithAggregatesFilter<"MasterGMTType"> | string
    isActive?: BoolWithAggregatesFilter<"MasterGMTType"> | boolean
  }

  export type MasterPortWhereInput = {
    AND?: MasterPortWhereInput | MasterPortWhereInput[]
    OR?: MasterPortWhereInput[]
    NOT?: MasterPortWhereInput | MasterPortWhereInput[]
    id?: StringFilter<"MasterPort"> | string
    country?: StringFilter<"MasterPort"> | string
    port?: StringFilter<"MasterPort"> | string
    ratePerKg?: FloatFilter<"MasterPort"> | number
    isActive?: BoolFilter<"MasterPort"> | boolean
    updatedAt?: DateTimeFilter<"MasterPort"> | Date | string
  }

  export type MasterPortOrderByWithRelationInput = {
    id?: SortOrder
    country?: SortOrder
    port?: SortOrder
    ratePerKg?: SortOrder
    isActive?: SortOrder
    updatedAt?: SortOrder
  }

  export type MasterPortWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    port?: string
    AND?: MasterPortWhereInput | MasterPortWhereInput[]
    OR?: MasterPortWhereInput[]
    NOT?: MasterPortWhereInput | MasterPortWhereInput[]
    country?: StringFilter<"MasterPort"> | string
    ratePerKg?: FloatFilter<"MasterPort"> | number
    isActive?: BoolFilter<"MasterPort"> | boolean
    updatedAt?: DateTimeFilter<"MasterPort"> | Date | string
  }, "id" | "port">

  export type MasterPortOrderByWithAggregationInput = {
    id?: SortOrder
    country?: SortOrder
    port?: SortOrder
    ratePerKg?: SortOrder
    isActive?: SortOrder
    updatedAt?: SortOrder
    _count?: MasterPortCountOrderByAggregateInput
    _avg?: MasterPortAvgOrderByAggregateInput
    _max?: MasterPortMaxOrderByAggregateInput
    _min?: MasterPortMinOrderByAggregateInput
    _sum?: MasterPortSumOrderByAggregateInput
  }

  export type MasterPortScalarWhereWithAggregatesInput = {
    AND?: MasterPortScalarWhereWithAggregatesInput | MasterPortScalarWhereWithAggregatesInput[]
    OR?: MasterPortScalarWhereWithAggregatesInput[]
    NOT?: MasterPortScalarWhereWithAggregatesInput | MasterPortScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"MasterPort"> | string
    country?: StringWithAggregatesFilter<"MasterPort"> | string
    port?: StringWithAggregatesFilter<"MasterPort"> | string
    ratePerKg?: FloatWithAggregatesFilter<"MasterPort"> | number
    isActive?: BoolWithAggregatesFilter<"MasterPort"> | boolean
    updatedAt?: DateTimeWithAggregatesFilter<"MasterPort"> | Date | string
  }

  export type AirRequestWhereInput = {
    AND?: AirRequestWhereInput | AirRequestWhereInput[]
    OR?: AirRequestWhereInput[]
    NOT?: AirRequestWhereInput | AirRequestWhereInput[]
    id?: StringFilter<"AirRequest"> | string
    documentNo?: StringFilter<"AirRequest"> | string
    brandName?: StringFilter<"AirRequest"> | string
    buName?: StringFilter<"AirRequest"> | string
    status?: StringFilter<"AirRequest"> | string
    claimDepartment?: StringNullableFilter<"AirRequest"> | string | null
    rejectionReason?: StringNullableFilter<"AirRequest"> | string | null
    createdById?: StringFilter<"AirRequest"> | string
    createdAt?: DateTimeFilter<"AirRequest"> | Date | string
    updatedAt?: DateTimeFilter<"AirRequest"> | Date | string
    invoiceNo?: StringNullableFilter<"AirRequest"> | string | null
    actualAirFreight?: FloatNullableFilter<"AirRequest"> | number | null
    bookingDate?: DateTimeNullableFilter<"AirRequest"> | Date | string | null
    airline?: StringNullableFilter<"AirRequest"> | string | null
    assignedVpMer?: StringNullableFilter<"AirRequest"> | string | null
    vpMerToken?: StringNullableFilter<"AirRequest"> | string | null
    presidentToken?: StringNullableFilter<"AirRequest"> | string | null
    scmToken?: StringNullableFilter<"AirRequest"> | string | null
    vpScmToken?: StringNullableFilter<"AirRequest"> | string | null
    assignedVpScm?: StringNullableFilter<"AirRequest"> | string | null
    logisticsToken?: StringNullableFilter<"AirRequest"> | string | null
    accountingToken?: StringNullableFilter<"AirRequest"> | string | null
    claimNextEmail?: StringNullableFilter<"AirRequest"> | string | null
    claimNextToken?: StringNullableFilter<"AirRequest"> | string | null
    claimNextName?: StringNullableFilter<"AirRequest"> | string | null
    bu?: StringFilter<"AirRequest"> | string
    createdBy?: XOR<UserRelationFilter, UserWhereInput>
    items?: AirRequestItemListRelationFilter
    approvalLogs?: ApprovalLogListRelationFilter
    attachments?: RequestAttachmentListRelationFilter
    hawbGroups?: HawbGroupListRelationFilter
  }

  export type AirRequestOrderByWithRelationInput = {
    id?: SortOrder
    documentNo?: SortOrder
    brandName?: SortOrder
    buName?: SortOrder
    status?: SortOrder
    claimDepartment?: SortOrderInput | SortOrder
    rejectionReason?: SortOrderInput | SortOrder
    createdById?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    invoiceNo?: SortOrderInput | SortOrder
    actualAirFreight?: SortOrderInput | SortOrder
    bookingDate?: SortOrderInput | SortOrder
    airline?: SortOrderInput | SortOrder
    assignedVpMer?: SortOrderInput | SortOrder
    vpMerToken?: SortOrderInput | SortOrder
    presidentToken?: SortOrderInput | SortOrder
    scmToken?: SortOrderInput | SortOrder
    vpScmToken?: SortOrderInput | SortOrder
    assignedVpScm?: SortOrderInput | SortOrder
    logisticsToken?: SortOrderInput | SortOrder
    accountingToken?: SortOrderInput | SortOrder
    claimNextEmail?: SortOrderInput | SortOrder
    claimNextToken?: SortOrderInput | SortOrder
    claimNextName?: SortOrderInput | SortOrder
    bu?: SortOrder
    createdBy?: UserOrderByWithRelationInput
    items?: AirRequestItemOrderByRelationAggregateInput
    approvalLogs?: ApprovalLogOrderByRelationAggregateInput
    attachments?: RequestAttachmentOrderByRelationAggregateInput
    hawbGroups?: HawbGroupOrderByRelationAggregateInput
  }

  export type AirRequestWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    documentNo?: string
    AND?: AirRequestWhereInput | AirRequestWhereInput[]
    OR?: AirRequestWhereInput[]
    NOT?: AirRequestWhereInput | AirRequestWhereInput[]
    brandName?: StringFilter<"AirRequest"> | string
    buName?: StringFilter<"AirRequest"> | string
    status?: StringFilter<"AirRequest"> | string
    claimDepartment?: StringNullableFilter<"AirRequest"> | string | null
    rejectionReason?: StringNullableFilter<"AirRequest"> | string | null
    createdById?: StringFilter<"AirRequest"> | string
    createdAt?: DateTimeFilter<"AirRequest"> | Date | string
    updatedAt?: DateTimeFilter<"AirRequest"> | Date | string
    invoiceNo?: StringNullableFilter<"AirRequest"> | string | null
    actualAirFreight?: FloatNullableFilter<"AirRequest"> | number | null
    bookingDate?: DateTimeNullableFilter<"AirRequest"> | Date | string | null
    airline?: StringNullableFilter<"AirRequest"> | string | null
    assignedVpMer?: StringNullableFilter<"AirRequest"> | string | null
    vpMerToken?: StringNullableFilter<"AirRequest"> | string | null
    presidentToken?: StringNullableFilter<"AirRequest"> | string | null
    scmToken?: StringNullableFilter<"AirRequest"> | string | null
    vpScmToken?: StringNullableFilter<"AirRequest"> | string | null
    assignedVpScm?: StringNullableFilter<"AirRequest"> | string | null
    logisticsToken?: StringNullableFilter<"AirRequest"> | string | null
    accountingToken?: StringNullableFilter<"AirRequest"> | string | null
    claimNextEmail?: StringNullableFilter<"AirRequest"> | string | null
    claimNextToken?: StringNullableFilter<"AirRequest"> | string | null
    claimNextName?: StringNullableFilter<"AirRequest"> | string | null
    bu?: StringFilter<"AirRequest"> | string
    createdBy?: XOR<UserRelationFilter, UserWhereInput>
    items?: AirRequestItemListRelationFilter
    approvalLogs?: ApprovalLogListRelationFilter
    attachments?: RequestAttachmentListRelationFilter
    hawbGroups?: HawbGroupListRelationFilter
  }, "id" | "documentNo">

  export type AirRequestOrderByWithAggregationInput = {
    id?: SortOrder
    documentNo?: SortOrder
    brandName?: SortOrder
    buName?: SortOrder
    status?: SortOrder
    claimDepartment?: SortOrderInput | SortOrder
    rejectionReason?: SortOrderInput | SortOrder
    createdById?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    invoiceNo?: SortOrderInput | SortOrder
    actualAirFreight?: SortOrderInput | SortOrder
    bookingDate?: SortOrderInput | SortOrder
    airline?: SortOrderInput | SortOrder
    assignedVpMer?: SortOrderInput | SortOrder
    vpMerToken?: SortOrderInput | SortOrder
    presidentToken?: SortOrderInput | SortOrder
    scmToken?: SortOrderInput | SortOrder
    vpScmToken?: SortOrderInput | SortOrder
    assignedVpScm?: SortOrderInput | SortOrder
    logisticsToken?: SortOrderInput | SortOrder
    accountingToken?: SortOrderInput | SortOrder
    claimNextEmail?: SortOrderInput | SortOrder
    claimNextToken?: SortOrderInput | SortOrder
    claimNextName?: SortOrderInput | SortOrder
    bu?: SortOrder
    _count?: AirRequestCountOrderByAggregateInput
    _avg?: AirRequestAvgOrderByAggregateInput
    _max?: AirRequestMaxOrderByAggregateInput
    _min?: AirRequestMinOrderByAggregateInput
    _sum?: AirRequestSumOrderByAggregateInput
  }

  export type AirRequestScalarWhereWithAggregatesInput = {
    AND?: AirRequestScalarWhereWithAggregatesInput | AirRequestScalarWhereWithAggregatesInput[]
    OR?: AirRequestScalarWhereWithAggregatesInput[]
    NOT?: AirRequestScalarWhereWithAggregatesInput | AirRequestScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"AirRequest"> | string
    documentNo?: StringWithAggregatesFilter<"AirRequest"> | string
    brandName?: StringWithAggregatesFilter<"AirRequest"> | string
    buName?: StringWithAggregatesFilter<"AirRequest"> | string
    status?: StringWithAggregatesFilter<"AirRequest"> | string
    claimDepartment?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    rejectionReason?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    createdById?: StringWithAggregatesFilter<"AirRequest"> | string
    createdAt?: DateTimeWithAggregatesFilter<"AirRequest"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"AirRequest"> | Date | string
    invoiceNo?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    actualAirFreight?: FloatNullableWithAggregatesFilter<"AirRequest"> | number | null
    bookingDate?: DateTimeNullableWithAggregatesFilter<"AirRequest"> | Date | string | null
    airline?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    assignedVpMer?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    vpMerToken?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    presidentToken?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    scmToken?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    vpScmToken?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    assignedVpScm?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    logisticsToken?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    accountingToken?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    claimNextEmail?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    claimNextToken?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    claimNextName?: StringNullableWithAggregatesFilter<"AirRequest"> | string | null
    bu?: StringWithAggregatesFilter<"AirRequest"> | string
  }

  export type ClaimApprovalWhereInput = {
    AND?: ClaimApprovalWhereInput | ClaimApprovalWhereInput[]
    OR?: ClaimApprovalWhereInput[]
    NOT?: ClaimApprovalWhereInput | ClaimApprovalWhereInput[]
    id?: StringFilter<"ClaimApproval"> | string
    itemId?: StringFilter<"ClaimApproval"> | string
    userId?: StringFilter<"ClaimApproval"> | string
    role?: StringFilter<"ClaimApproval"> | string
    createdAt?: DateTimeFilter<"ClaimApproval"> | Date | string
    item?: XOR<AirRequestItemRelationFilter, AirRequestItemWhereInput>
    user?: XOR<UserRelationFilter, UserWhereInput>
  }

  export type ClaimApprovalOrderByWithRelationInput = {
    id?: SortOrder
    itemId?: SortOrder
    userId?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
    item?: AirRequestItemOrderByWithRelationInput
    user?: UserOrderByWithRelationInput
  }

  export type ClaimApprovalWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    itemId_userId?: ClaimApprovalItemIdUserIdCompoundUniqueInput
    AND?: ClaimApprovalWhereInput | ClaimApprovalWhereInput[]
    OR?: ClaimApprovalWhereInput[]
    NOT?: ClaimApprovalWhereInput | ClaimApprovalWhereInput[]
    itemId?: StringFilter<"ClaimApproval"> | string
    userId?: StringFilter<"ClaimApproval"> | string
    role?: StringFilter<"ClaimApproval"> | string
    createdAt?: DateTimeFilter<"ClaimApproval"> | Date | string
    item?: XOR<AirRequestItemRelationFilter, AirRequestItemWhereInput>
    user?: XOR<UserRelationFilter, UserWhereInput>
  }, "id" | "itemId_userId">

  export type ClaimApprovalOrderByWithAggregationInput = {
    id?: SortOrder
    itemId?: SortOrder
    userId?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
    _count?: ClaimApprovalCountOrderByAggregateInput
    _max?: ClaimApprovalMaxOrderByAggregateInput
    _min?: ClaimApprovalMinOrderByAggregateInput
  }

  export type ClaimApprovalScalarWhereWithAggregatesInput = {
    AND?: ClaimApprovalScalarWhereWithAggregatesInput | ClaimApprovalScalarWhereWithAggregatesInput[]
    OR?: ClaimApprovalScalarWhereWithAggregatesInput[]
    NOT?: ClaimApprovalScalarWhereWithAggregatesInput | ClaimApprovalScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ClaimApproval"> | string
    itemId?: StringWithAggregatesFilter<"ClaimApproval"> | string
    userId?: StringWithAggregatesFilter<"ClaimApproval"> | string
    role?: StringWithAggregatesFilter<"ClaimApproval"> | string
    createdAt?: DateTimeWithAggregatesFilter<"ClaimApproval"> | Date | string
  }

  export type HawbGroupWhereInput = {
    AND?: HawbGroupWhereInput | HawbGroupWhereInput[]
    OR?: HawbGroupWhereInput[]
    NOT?: HawbGroupWhereInput | HawbGroupWhereInput[]
    id?: StringFilter<"HawbGroup"> | string
    requestId?: StringFilter<"HawbGroup"> | string
    hawbNo?: StringFilter<"HawbGroup"> | string
    totalCharge?: FloatFilter<"HawbGroup"> | number
    createdAt?: DateTimeFilter<"HawbGroup"> | Date | string
    request?: XOR<AirRequestRelationFilter, AirRequestWhereInput>
    items?: AirRequestItemListRelationFilter
  }

  export type HawbGroupOrderByWithRelationInput = {
    id?: SortOrder
    requestId?: SortOrder
    hawbNo?: SortOrder
    totalCharge?: SortOrder
    createdAt?: SortOrder
    request?: AirRequestOrderByWithRelationInput
    items?: AirRequestItemOrderByRelationAggregateInput
  }

  export type HawbGroupWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: HawbGroupWhereInput | HawbGroupWhereInput[]
    OR?: HawbGroupWhereInput[]
    NOT?: HawbGroupWhereInput | HawbGroupWhereInput[]
    requestId?: StringFilter<"HawbGroup"> | string
    hawbNo?: StringFilter<"HawbGroup"> | string
    totalCharge?: FloatFilter<"HawbGroup"> | number
    createdAt?: DateTimeFilter<"HawbGroup"> | Date | string
    request?: XOR<AirRequestRelationFilter, AirRequestWhereInput>
    items?: AirRequestItemListRelationFilter
  }, "id">

  export type HawbGroupOrderByWithAggregationInput = {
    id?: SortOrder
    requestId?: SortOrder
    hawbNo?: SortOrder
    totalCharge?: SortOrder
    createdAt?: SortOrder
    _count?: HawbGroupCountOrderByAggregateInput
    _avg?: HawbGroupAvgOrderByAggregateInput
    _max?: HawbGroupMaxOrderByAggregateInput
    _min?: HawbGroupMinOrderByAggregateInput
    _sum?: HawbGroupSumOrderByAggregateInput
  }

  export type HawbGroupScalarWhereWithAggregatesInput = {
    AND?: HawbGroupScalarWhereWithAggregatesInput | HawbGroupScalarWhereWithAggregatesInput[]
    OR?: HawbGroupScalarWhereWithAggregatesInput[]
    NOT?: HawbGroupScalarWhereWithAggregatesInput | HawbGroupScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"HawbGroup"> | string
    requestId?: StringWithAggregatesFilter<"HawbGroup"> | string
    hawbNo?: StringWithAggregatesFilter<"HawbGroup"> | string
    totalCharge?: FloatWithAggregatesFilter<"HawbGroup"> | number
    createdAt?: DateTimeWithAggregatesFilter<"HawbGroup"> | Date | string
  }

  export type AirRequestItemWhereInput = {
    AND?: AirRequestItemWhereInput | AirRequestItemWhereInput[]
    OR?: AirRequestItemWhereInput[]
    NOT?: AirRequestItemWhereInput | AirRequestItemWhereInput[]
    id?: StringFilter<"AirRequestItem"> | string
    requestId?: StringFilter<"AirRequestItem"> | string
    hawbGroupId?: StringNullableFilter<"AirRequestItem"> | string | null
    style?: StringFilter<"AirRequestItem"> | string
    so?: StringFilter<"AirRequestItem"> | string
    sub?: StringNullableFilter<"AirRequestItem"> | string | null
    customerPO?: StringNullableFilter<"AirRequestItem"> | string | null
    description?: StringNullableFilter<"AirRequestItem"> | string | null
    gmtType?: StringNullableFilter<"AirRequestItem"> | string | null
    originalShipmentDate?: DateTimeNullableFilter<"AirRequestItem"> | Date | string | null
    planShipmentDate?: DateTimeNullableFilter<"AirRequestItem"> | Date | string | null
    qtyOriginalShipment?: IntFilter<"AirRequestItem"> | number
    qtyRequestAir?: IntFilter<"AirRequestItem"> | number
    itemStatus?: StringFilter<"AirRequestItem"> | string
    itemComment?: StringNullableFilter<"AirRequestItem"> | string | null
    reasonDelay?: StringFilter<"AirRequestItem"> | string
    factory?: StringFilter<"AirRequestItem"> | string
    country?: StringFilter<"AirRequestItem"> | string
    port?: StringFilter<"AirRequestItem"> | string
    grossWeight?: FloatNullableFilter<"AirRequestItem"> | number | null
    airFreight?: FloatNullableFilter<"AirRequestItem"> | number | null
    marketRatePerKg?: FloatNullableFilter<"AirRequestItem"> | number | null
    actualAirFreight?: FloatNullableFilter<"AirRequestItem"> | number | null
    claimDepartment?: StringNullableFilter<"AirRequestItem"> | string | null
    invoiceNo?: StringNullableFilter<"AirRequestItem"> | string | null
    hawbNo?: StringNullableFilter<"AirRequestItem"> | string | null
    bookingDate?: DateTimeNullableFilter<"AirRequestItem"> | Date | string | null
    assignedDvm?: StringNullableFilter<"AirRequestItem"> | string | null
    claimPercentage?: FloatNullableFilter<"AirRequestItem"> | number | null
    qtyActualShip?: IntNullableFilter<"AirRequestItem"> | number | null
    request?: XOR<AirRequestRelationFilter, AirRequestWhereInput>
    hawbGroup?: XOR<HawbGroupNullableRelationFilter, HawbGroupWhereInput> | null
    claimApprovals?: ClaimApprovalListRelationFilter
  }

  export type AirRequestItemOrderByWithRelationInput = {
    id?: SortOrder
    requestId?: SortOrder
    hawbGroupId?: SortOrderInput | SortOrder
    style?: SortOrder
    so?: SortOrder
    sub?: SortOrderInput | SortOrder
    customerPO?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    gmtType?: SortOrderInput | SortOrder
    originalShipmentDate?: SortOrderInput | SortOrder
    planShipmentDate?: SortOrderInput | SortOrder
    qtyOriginalShipment?: SortOrder
    qtyRequestAir?: SortOrder
    itemStatus?: SortOrder
    itemComment?: SortOrderInput | SortOrder
    reasonDelay?: SortOrder
    factory?: SortOrder
    country?: SortOrder
    port?: SortOrder
    grossWeight?: SortOrderInput | SortOrder
    airFreight?: SortOrderInput | SortOrder
    marketRatePerKg?: SortOrderInput | SortOrder
    actualAirFreight?: SortOrderInput | SortOrder
    claimDepartment?: SortOrderInput | SortOrder
    invoiceNo?: SortOrderInput | SortOrder
    hawbNo?: SortOrderInput | SortOrder
    bookingDate?: SortOrderInput | SortOrder
    assignedDvm?: SortOrderInput | SortOrder
    claimPercentage?: SortOrderInput | SortOrder
    qtyActualShip?: SortOrderInput | SortOrder
    request?: AirRequestOrderByWithRelationInput
    hawbGroup?: HawbGroupOrderByWithRelationInput
    claimApprovals?: ClaimApprovalOrderByRelationAggregateInput
  }

  export type AirRequestItemWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: AirRequestItemWhereInput | AirRequestItemWhereInput[]
    OR?: AirRequestItemWhereInput[]
    NOT?: AirRequestItemWhereInput | AirRequestItemWhereInput[]
    requestId?: StringFilter<"AirRequestItem"> | string
    hawbGroupId?: StringNullableFilter<"AirRequestItem"> | string | null
    style?: StringFilter<"AirRequestItem"> | string
    so?: StringFilter<"AirRequestItem"> | string
    sub?: StringNullableFilter<"AirRequestItem"> | string | null
    customerPO?: StringNullableFilter<"AirRequestItem"> | string | null
    description?: StringNullableFilter<"AirRequestItem"> | string | null
    gmtType?: StringNullableFilter<"AirRequestItem"> | string | null
    originalShipmentDate?: DateTimeNullableFilter<"AirRequestItem"> | Date | string | null
    planShipmentDate?: DateTimeNullableFilter<"AirRequestItem"> | Date | string | null
    qtyOriginalShipment?: IntFilter<"AirRequestItem"> | number
    qtyRequestAir?: IntFilter<"AirRequestItem"> | number
    itemStatus?: StringFilter<"AirRequestItem"> | string
    itemComment?: StringNullableFilter<"AirRequestItem"> | string | null
    reasonDelay?: StringFilter<"AirRequestItem"> | string
    factory?: StringFilter<"AirRequestItem"> | string
    country?: StringFilter<"AirRequestItem"> | string
    port?: StringFilter<"AirRequestItem"> | string
    grossWeight?: FloatNullableFilter<"AirRequestItem"> | number | null
    airFreight?: FloatNullableFilter<"AirRequestItem"> | number | null
    marketRatePerKg?: FloatNullableFilter<"AirRequestItem"> | number | null
    actualAirFreight?: FloatNullableFilter<"AirRequestItem"> | number | null
    claimDepartment?: StringNullableFilter<"AirRequestItem"> | string | null
    invoiceNo?: StringNullableFilter<"AirRequestItem"> | string | null
    hawbNo?: StringNullableFilter<"AirRequestItem"> | string | null
    bookingDate?: DateTimeNullableFilter<"AirRequestItem"> | Date | string | null
    assignedDvm?: StringNullableFilter<"AirRequestItem"> | string | null
    claimPercentage?: FloatNullableFilter<"AirRequestItem"> | number | null
    qtyActualShip?: IntNullableFilter<"AirRequestItem"> | number | null
    request?: XOR<AirRequestRelationFilter, AirRequestWhereInput>
    hawbGroup?: XOR<HawbGroupNullableRelationFilter, HawbGroupWhereInput> | null
    claimApprovals?: ClaimApprovalListRelationFilter
  }, "id">

  export type AirRequestItemOrderByWithAggregationInput = {
    id?: SortOrder
    requestId?: SortOrder
    hawbGroupId?: SortOrderInput | SortOrder
    style?: SortOrder
    so?: SortOrder
    sub?: SortOrderInput | SortOrder
    customerPO?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    gmtType?: SortOrderInput | SortOrder
    originalShipmentDate?: SortOrderInput | SortOrder
    planShipmentDate?: SortOrderInput | SortOrder
    qtyOriginalShipment?: SortOrder
    qtyRequestAir?: SortOrder
    itemStatus?: SortOrder
    itemComment?: SortOrderInput | SortOrder
    reasonDelay?: SortOrder
    factory?: SortOrder
    country?: SortOrder
    port?: SortOrder
    grossWeight?: SortOrderInput | SortOrder
    airFreight?: SortOrderInput | SortOrder
    marketRatePerKg?: SortOrderInput | SortOrder
    actualAirFreight?: SortOrderInput | SortOrder
    claimDepartment?: SortOrderInput | SortOrder
    invoiceNo?: SortOrderInput | SortOrder
    hawbNo?: SortOrderInput | SortOrder
    bookingDate?: SortOrderInput | SortOrder
    assignedDvm?: SortOrderInput | SortOrder
    claimPercentage?: SortOrderInput | SortOrder
    qtyActualShip?: SortOrderInput | SortOrder
    _count?: AirRequestItemCountOrderByAggregateInput
    _avg?: AirRequestItemAvgOrderByAggregateInput
    _max?: AirRequestItemMaxOrderByAggregateInput
    _min?: AirRequestItemMinOrderByAggregateInput
    _sum?: AirRequestItemSumOrderByAggregateInput
  }

  export type AirRequestItemScalarWhereWithAggregatesInput = {
    AND?: AirRequestItemScalarWhereWithAggregatesInput | AirRequestItemScalarWhereWithAggregatesInput[]
    OR?: AirRequestItemScalarWhereWithAggregatesInput[]
    NOT?: AirRequestItemScalarWhereWithAggregatesInput | AirRequestItemScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"AirRequestItem"> | string
    requestId?: StringWithAggregatesFilter<"AirRequestItem"> | string
    hawbGroupId?: StringNullableWithAggregatesFilter<"AirRequestItem"> | string | null
    style?: StringWithAggregatesFilter<"AirRequestItem"> | string
    so?: StringWithAggregatesFilter<"AirRequestItem"> | string
    sub?: StringNullableWithAggregatesFilter<"AirRequestItem"> | string | null
    customerPO?: StringNullableWithAggregatesFilter<"AirRequestItem"> | string | null
    description?: StringNullableWithAggregatesFilter<"AirRequestItem"> | string | null
    gmtType?: StringNullableWithAggregatesFilter<"AirRequestItem"> | string | null
    originalShipmentDate?: DateTimeNullableWithAggregatesFilter<"AirRequestItem"> | Date | string | null
    planShipmentDate?: DateTimeNullableWithAggregatesFilter<"AirRequestItem"> | Date | string | null
    qtyOriginalShipment?: IntWithAggregatesFilter<"AirRequestItem"> | number
    qtyRequestAir?: IntWithAggregatesFilter<"AirRequestItem"> | number
    itemStatus?: StringWithAggregatesFilter<"AirRequestItem"> | string
    itemComment?: StringNullableWithAggregatesFilter<"AirRequestItem"> | string | null
    reasonDelay?: StringWithAggregatesFilter<"AirRequestItem"> | string
    factory?: StringWithAggregatesFilter<"AirRequestItem"> | string
    country?: StringWithAggregatesFilter<"AirRequestItem"> | string
    port?: StringWithAggregatesFilter<"AirRequestItem"> | string
    grossWeight?: FloatNullableWithAggregatesFilter<"AirRequestItem"> | number | null
    airFreight?: FloatNullableWithAggregatesFilter<"AirRequestItem"> | number | null
    marketRatePerKg?: FloatNullableWithAggregatesFilter<"AirRequestItem"> | number | null
    actualAirFreight?: FloatNullableWithAggregatesFilter<"AirRequestItem"> | number | null
    claimDepartment?: StringNullableWithAggregatesFilter<"AirRequestItem"> | string | null
    invoiceNo?: StringNullableWithAggregatesFilter<"AirRequestItem"> | string | null
    hawbNo?: StringNullableWithAggregatesFilter<"AirRequestItem"> | string | null
    bookingDate?: DateTimeNullableWithAggregatesFilter<"AirRequestItem"> | Date | string | null
    assignedDvm?: StringNullableWithAggregatesFilter<"AirRequestItem"> | string | null
    claimPercentage?: FloatNullableWithAggregatesFilter<"AirRequestItem"> | number | null
    qtyActualShip?: IntNullableWithAggregatesFilter<"AirRequestItem"> | number | null
  }

  export type ApprovalLogWhereInput = {
    AND?: ApprovalLogWhereInput | ApprovalLogWhereInput[]
    OR?: ApprovalLogWhereInput[]
    NOT?: ApprovalLogWhereInput | ApprovalLogWhereInput[]
    id?: StringFilter<"ApprovalLog"> | string
    requestId?: StringFilter<"ApprovalLog"> | string
    userId?: StringFilter<"ApprovalLog"> | string
    action?: StringFilter<"ApprovalLog"> | string
    fromStatus?: StringFilter<"ApprovalLog"> | string
    toStatus?: StringFilter<"ApprovalLog"> | string
    comment?: StringNullableFilter<"ApprovalLog"> | string | null
    createdAt?: DateTimeFilter<"ApprovalLog"> | Date | string
    request?: XOR<AirRequestRelationFilter, AirRequestWhereInput>
    user?: XOR<UserRelationFilter, UserWhereInput>
  }

  export type ApprovalLogOrderByWithRelationInput = {
    id?: SortOrder
    requestId?: SortOrder
    userId?: SortOrder
    action?: SortOrder
    fromStatus?: SortOrder
    toStatus?: SortOrder
    comment?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    request?: AirRequestOrderByWithRelationInput
    user?: UserOrderByWithRelationInput
  }

  export type ApprovalLogWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ApprovalLogWhereInput | ApprovalLogWhereInput[]
    OR?: ApprovalLogWhereInput[]
    NOT?: ApprovalLogWhereInput | ApprovalLogWhereInput[]
    requestId?: StringFilter<"ApprovalLog"> | string
    userId?: StringFilter<"ApprovalLog"> | string
    action?: StringFilter<"ApprovalLog"> | string
    fromStatus?: StringFilter<"ApprovalLog"> | string
    toStatus?: StringFilter<"ApprovalLog"> | string
    comment?: StringNullableFilter<"ApprovalLog"> | string | null
    createdAt?: DateTimeFilter<"ApprovalLog"> | Date | string
    request?: XOR<AirRequestRelationFilter, AirRequestWhereInput>
    user?: XOR<UserRelationFilter, UserWhereInput>
  }, "id">

  export type ApprovalLogOrderByWithAggregationInput = {
    id?: SortOrder
    requestId?: SortOrder
    userId?: SortOrder
    action?: SortOrder
    fromStatus?: SortOrder
    toStatus?: SortOrder
    comment?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: ApprovalLogCountOrderByAggregateInput
    _max?: ApprovalLogMaxOrderByAggregateInput
    _min?: ApprovalLogMinOrderByAggregateInput
  }

  export type ApprovalLogScalarWhereWithAggregatesInput = {
    AND?: ApprovalLogScalarWhereWithAggregatesInput | ApprovalLogScalarWhereWithAggregatesInput[]
    OR?: ApprovalLogScalarWhereWithAggregatesInput[]
    NOT?: ApprovalLogScalarWhereWithAggregatesInput | ApprovalLogScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ApprovalLog"> | string
    requestId?: StringWithAggregatesFilter<"ApprovalLog"> | string
    userId?: StringWithAggregatesFilter<"ApprovalLog"> | string
    action?: StringWithAggregatesFilter<"ApprovalLog"> | string
    fromStatus?: StringWithAggregatesFilter<"ApprovalLog"> | string
    toStatus?: StringWithAggregatesFilter<"ApprovalLog"> | string
    comment?: StringNullableWithAggregatesFilter<"ApprovalLog"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"ApprovalLog"> | Date | string
  }

  export type RequestAttachmentWhereInput = {
    AND?: RequestAttachmentWhereInput | RequestAttachmentWhereInput[]
    OR?: RequestAttachmentWhereInput[]
    NOT?: RequestAttachmentWhereInput | RequestAttachmentWhereInput[]
    id?: StringFilter<"RequestAttachment"> | string
    requestId?: StringFilter<"RequestAttachment"> | string
    itemId?: StringNullableFilter<"RequestAttachment"> | string | null
    uploadedById?: StringFilter<"RequestAttachment"> | string
    fileName?: StringFilter<"RequestAttachment"> | string
    filePath?: StringFilter<"RequestAttachment"> | string
    fileSize?: IntFilter<"RequestAttachment"> | number
    mimeType?: StringFilter<"RequestAttachment"> | string
    claimDept?: StringNullableFilter<"RequestAttachment"> | string | null
    createdAt?: DateTimeFilter<"RequestAttachment"> | Date | string
    request?: XOR<AirRequestRelationFilter, AirRequestWhereInput>
    uploadedBy?: XOR<UserRelationFilter, UserWhereInput>
  }

  export type RequestAttachmentOrderByWithRelationInput = {
    id?: SortOrder
    requestId?: SortOrder
    itemId?: SortOrderInput | SortOrder
    uploadedById?: SortOrder
    fileName?: SortOrder
    filePath?: SortOrder
    fileSize?: SortOrder
    mimeType?: SortOrder
    claimDept?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    request?: AirRequestOrderByWithRelationInput
    uploadedBy?: UserOrderByWithRelationInput
  }

  export type RequestAttachmentWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: RequestAttachmentWhereInput | RequestAttachmentWhereInput[]
    OR?: RequestAttachmentWhereInput[]
    NOT?: RequestAttachmentWhereInput | RequestAttachmentWhereInput[]
    requestId?: StringFilter<"RequestAttachment"> | string
    itemId?: StringNullableFilter<"RequestAttachment"> | string | null
    uploadedById?: StringFilter<"RequestAttachment"> | string
    fileName?: StringFilter<"RequestAttachment"> | string
    filePath?: StringFilter<"RequestAttachment"> | string
    fileSize?: IntFilter<"RequestAttachment"> | number
    mimeType?: StringFilter<"RequestAttachment"> | string
    claimDept?: StringNullableFilter<"RequestAttachment"> | string | null
    createdAt?: DateTimeFilter<"RequestAttachment"> | Date | string
    request?: XOR<AirRequestRelationFilter, AirRequestWhereInput>
    uploadedBy?: XOR<UserRelationFilter, UserWhereInput>
  }, "id">

  export type RequestAttachmentOrderByWithAggregationInput = {
    id?: SortOrder
    requestId?: SortOrder
    itemId?: SortOrderInput | SortOrder
    uploadedById?: SortOrder
    fileName?: SortOrder
    filePath?: SortOrder
    fileSize?: SortOrder
    mimeType?: SortOrder
    claimDept?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: RequestAttachmentCountOrderByAggregateInput
    _avg?: RequestAttachmentAvgOrderByAggregateInput
    _max?: RequestAttachmentMaxOrderByAggregateInput
    _min?: RequestAttachmentMinOrderByAggregateInput
    _sum?: RequestAttachmentSumOrderByAggregateInput
  }

  export type RequestAttachmentScalarWhereWithAggregatesInput = {
    AND?: RequestAttachmentScalarWhereWithAggregatesInput | RequestAttachmentScalarWhereWithAggregatesInput[]
    OR?: RequestAttachmentScalarWhereWithAggregatesInput[]
    NOT?: RequestAttachmentScalarWhereWithAggregatesInput | RequestAttachmentScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"RequestAttachment"> | string
    requestId?: StringWithAggregatesFilter<"RequestAttachment"> | string
    itemId?: StringNullableWithAggregatesFilter<"RequestAttachment"> | string | null
    uploadedById?: StringWithAggregatesFilter<"RequestAttachment"> | string
    fileName?: StringWithAggregatesFilter<"RequestAttachment"> | string
    filePath?: StringWithAggregatesFilter<"RequestAttachment"> | string
    fileSize?: IntWithAggregatesFilter<"RequestAttachment"> | number
    mimeType?: StringWithAggregatesFilter<"RequestAttachment"> | string
    claimDept?: StringNullableWithAggregatesFilter<"RequestAttachment"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"RequestAttachment"> | Date | string
  }

  export type UserCreateInput = {
    id?: string
    name?: string | null
    email: string
    password?: string | null
    role?: string
    claimDepartment?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    priority?: number | null
    bu?: string
    procurementType?: string | null
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    airRequests?: AirRequestCreateNestedManyWithoutCreatedByInput
    approvals?: ApprovalLogCreateNestedManyWithoutUserInput
    claimApprovals?: ClaimApprovalCreateNestedManyWithoutUserInput
    attachments?: RequestAttachmentCreateNestedManyWithoutUploadedByInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    name?: string | null
    email: string
    password?: string | null
    role?: string
    claimDepartment?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    priority?: number | null
    bu?: string
    procurementType?: string | null
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    airRequests?: AirRequestUncheckedCreateNestedManyWithoutCreatedByInput
    approvals?: ApprovalLogUncheckedCreateNestedManyWithoutUserInput
    claimApprovals?: ClaimApprovalUncheckedCreateNestedManyWithoutUserInput
    attachments?: RequestAttachmentUncheckedCreateNestedManyWithoutUploadedByInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    priority?: NullableIntFieldUpdateOperationsInput | number | null
    bu?: StringFieldUpdateOperationsInput | string
    procurementType?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airRequests?: AirRequestUpdateManyWithoutCreatedByNestedInput
    approvals?: ApprovalLogUpdateManyWithoutUserNestedInput
    claimApprovals?: ClaimApprovalUpdateManyWithoutUserNestedInput
    attachments?: RequestAttachmentUpdateManyWithoutUploadedByNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    priority?: NullableIntFieldUpdateOperationsInput | number | null
    bu?: StringFieldUpdateOperationsInput | string
    procurementType?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airRequests?: AirRequestUncheckedUpdateManyWithoutCreatedByNestedInput
    approvals?: ApprovalLogUncheckedUpdateManyWithoutUserNestedInput
    claimApprovals?: ClaimApprovalUncheckedUpdateManyWithoutUserNestedInput
    attachments?: RequestAttachmentUncheckedUpdateManyWithoutUploadedByNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    name?: string | null
    email: string
    password?: string | null
    role?: string
    claimDepartment?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    priority?: number | null
    bu?: string
    procurementType?: string | null
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    priority?: NullableIntFieldUpdateOperationsInput | number | null
    bu?: StringFieldUpdateOperationsInput | string
    procurementType?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    priority?: NullableIntFieldUpdateOperationsInput | number | null
    bu?: StringFieldUpdateOperationsInput | string
    procurementType?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type MasterBrandCreateInput = {
    id?: string
    name: string
    isActive?: boolean
  }

  export type MasterBrandUncheckedCreateInput = {
    id?: string
    name: string
    isActive?: boolean
  }

  export type MasterBrandUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterBrandUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterBrandCreateManyInput = {
    id?: string
    name: string
    isActive?: boolean
  }

  export type MasterBrandUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterBrandUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterBUCreateInput = {
    id?: string
    name: string
    isActive?: boolean
  }

  export type MasterBUUncheckedCreateInput = {
    id?: string
    name: string
    isActive?: boolean
  }

  export type MasterBUUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterBUUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterBUCreateManyInput = {
    id?: string
    name: string
    isActive?: boolean
  }

  export type MasterBUUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterBUUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterDescriptionCreateInput = {
    id?: string
    name: string
    weightPerUnit?: number
    isActive?: boolean
  }

  export type MasterDescriptionUncheckedCreateInput = {
    id?: string
    name: string
    weightPerUnit?: number
    isActive?: boolean
  }

  export type MasterDescriptionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    weightPerUnit?: FloatFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterDescriptionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    weightPerUnit?: FloatFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterDescriptionCreateManyInput = {
    id?: string
    name: string
    weightPerUnit?: number
    isActive?: boolean
  }

  export type MasterDescriptionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    weightPerUnit?: FloatFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterDescriptionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    weightPerUnit?: FloatFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterGMTTypeCreateInput = {
    id?: string
    name: string
    isActive?: boolean
  }

  export type MasterGMTTypeUncheckedCreateInput = {
    id?: string
    name: string
    isActive?: boolean
  }

  export type MasterGMTTypeUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterGMTTypeUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterGMTTypeCreateManyInput = {
    id?: string
    name: string
    isActive?: boolean
  }

  export type MasterGMTTypeUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterGMTTypeUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
  }

  export type MasterPortCreateInput = {
    id?: string
    country: string
    port: string
    ratePerKg?: number
    isActive?: boolean
    updatedAt?: Date | string
  }

  export type MasterPortUncheckedCreateInput = {
    id?: string
    country: string
    port: string
    ratePerKg?: number
    isActive?: boolean
    updatedAt?: Date | string
  }

  export type MasterPortUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    ratePerKg?: FloatFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MasterPortUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    ratePerKg?: FloatFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MasterPortCreateManyInput = {
    id?: string
    country: string
    port: string
    ratePerKg?: number
    isActive?: boolean
    updatedAt?: Date | string
  }

  export type MasterPortUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    ratePerKg?: FloatFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MasterPortUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    ratePerKg?: FloatFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AirRequestCreateInput = {
    id?: string
    documentNo: string
    brandName: string
    buName: string
    status?: string
    claimDepartment?: string | null
    rejectionReason?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    invoiceNo?: string | null
    actualAirFreight?: number | null
    bookingDate?: Date | string | null
    airline?: string | null
    assignedVpMer?: string | null
    vpMerToken?: string | null
    presidentToken?: string | null
    scmToken?: string | null
    vpScmToken?: string | null
    assignedVpScm?: string | null
    logisticsToken?: string | null
    accountingToken?: string | null
    claimNextEmail?: string | null
    claimNextToken?: string | null
    claimNextName?: string | null
    bu?: string
    createdBy: UserCreateNestedOneWithoutAirRequestsInput
    items?: AirRequestItemCreateNestedManyWithoutRequestInput
    approvalLogs?: ApprovalLogCreateNestedManyWithoutRequestInput
    attachments?: RequestAttachmentCreateNestedManyWithoutRequestInput
    hawbGroups?: HawbGroupCreateNestedManyWithoutRequestInput
  }

  export type AirRequestUncheckedCreateInput = {
    id?: string
    documentNo: string
    brandName: string
    buName: string
    status?: string
    claimDepartment?: string | null
    rejectionReason?: string | null
    createdById: string
    createdAt?: Date | string
    updatedAt?: Date | string
    invoiceNo?: string | null
    actualAirFreight?: number | null
    bookingDate?: Date | string | null
    airline?: string | null
    assignedVpMer?: string | null
    vpMerToken?: string | null
    presidentToken?: string | null
    scmToken?: string | null
    vpScmToken?: string | null
    assignedVpScm?: string | null
    logisticsToken?: string | null
    accountingToken?: string | null
    claimNextEmail?: string | null
    claimNextToken?: string | null
    claimNextName?: string | null
    bu?: string
    items?: AirRequestItemUncheckedCreateNestedManyWithoutRequestInput
    approvalLogs?: ApprovalLogUncheckedCreateNestedManyWithoutRequestInput
    attachments?: RequestAttachmentUncheckedCreateNestedManyWithoutRequestInput
    hawbGroups?: HawbGroupUncheckedCreateNestedManyWithoutRequestInput
  }

  export type AirRequestUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
    createdBy?: UserUpdateOneRequiredWithoutAirRequestsNestedInput
    items?: AirRequestItemUpdateManyWithoutRequestNestedInput
    approvalLogs?: ApprovalLogUpdateManyWithoutRequestNestedInput
    attachments?: RequestAttachmentUpdateManyWithoutRequestNestedInput
    hawbGroups?: HawbGroupUpdateManyWithoutRequestNestedInput
  }

  export type AirRequestUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
    items?: AirRequestItemUncheckedUpdateManyWithoutRequestNestedInput
    approvalLogs?: ApprovalLogUncheckedUpdateManyWithoutRequestNestedInput
    attachments?: RequestAttachmentUncheckedUpdateManyWithoutRequestNestedInput
    hawbGroups?: HawbGroupUncheckedUpdateManyWithoutRequestNestedInput
  }

  export type AirRequestCreateManyInput = {
    id?: string
    documentNo: string
    brandName: string
    buName: string
    status?: string
    claimDepartment?: string | null
    rejectionReason?: string | null
    createdById: string
    createdAt?: Date | string
    updatedAt?: Date | string
    invoiceNo?: string | null
    actualAirFreight?: number | null
    bookingDate?: Date | string | null
    airline?: string | null
    assignedVpMer?: string | null
    vpMerToken?: string | null
    presidentToken?: string | null
    scmToken?: string | null
    vpScmToken?: string | null
    assignedVpScm?: string | null
    logisticsToken?: string | null
    accountingToken?: string | null
    claimNextEmail?: string | null
    claimNextToken?: string | null
    claimNextName?: string | null
    bu?: string
  }

  export type AirRequestUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
  }

  export type AirRequestUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
  }

  export type ClaimApprovalCreateInput = {
    id?: string
    role: string
    createdAt?: Date | string
    item: AirRequestItemCreateNestedOneWithoutClaimApprovalsInput
    user: UserCreateNestedOneWithoutClaimApprovalsInput
  }

  export type ClaimApprovalUncheckedCreateInput = {
    id?: string
    itemId: string
    userId: string
    role: string
    createdAt?: Date | string
  }

  export type ClaimApprovalUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    item?: AirRequestItemUpdateOneRequiredWithoutClaimApprovalsNestedInput
    user?: UserUpdateOneRequiredWithoutClaimApprovalsNestedInput
  }

  export type ClaimApprovalUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    itemId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClaimApprovalCreateManyInput = {
    id?: string
    itemId: string
    userId: string
    role: string
    createdAt?: Date | string
  }

  export type ClaimApprovalUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClaimApprovalUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    itemId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HawbGroupCreateInput = {
    id?: string
    hawbNo: string
    totalCharge: number
    createdAt?: Date | string
    request: AirRequestCreateNestedOneWithoutHawbGroupsInput
    items?: AirRequestItemCreateNestedManyWithoutHawbGroupInput
  }

  export type HawbGroupUncheckedCreateInput = {
    id?: string
    requestId: string
    hawbNo: string
    totalCharge: number
    createdAt?: Date | string
    items?: AirRequestItemUncheckedCreateNestedManyWithoutHawbGroupInput
  }

  export type HawbGroupUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    hawbNo?: StringFieldUpdateOperationsInput | string
    totalCharge?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    request?: AirRequestUpdateOneRequiredWithoutHawbGroupsNestedInput
    items?: AirRequestItemUpdateManyWithoutHawbGroupNestedInput
  }

  export type HawbGroupUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    hawbNo?: StringFieldUpdateOperationsInput | string
    totalCharge?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    items?: AirRequestItemUncheckedUpdateManyWithoutHawbGroupNestedInput
  }

  export type HawbGroupCreateManyInput = {
    id?: string
    requestId: string
    hawbNo: string
    totalCharge: number
    createdAt?: Date | string
  }

  export type HawbGroupUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    hawbNo?: StringFieldUpdateOperationsInput | string
    totalCharge?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HawbGroupUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    hawbNo?: StringFieldUpdateOperationsInput | string
    totalCharge?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AirRequestItemCreateInput = {
    id?: string
    style: string
    so: string
    sub?: string | null
    customerPO?: string | null
    description?: string | null
    gmtType?: string | null
    originalShipmentDate?: Date | string | null
    planShipmentDate?: Date | string | null
    qtyOriginalShipment: number
    qtyRequestAir: number
    itemStatus?: string
    itemComment?: string | null
    reasonDelay: string
    factory: string
    country: string
    port: string
    grossWeight?: number | null
    airFreight?: number | null
    marketRatePerKg?: number | null
    actualAirFreight?: number | null
    claimDepartment?: string | null
    invoiceNo?: string | null
    hawbNo?: string | null
    bookingDate?: Date | string | null
    assignedDvm?: string | null
    claimPercentage?: number | null
    qtyActualShip?: number | null
    request: AirRequestCreateNestedOneWithoutItemsInput
    hawbGroup?: HawbGroupCreateNestedOneWithoutItemsInput
    claimApprovals?: ClaimApprovalCreateNestedManyWithoutItemInput
  }

  export type AirRequestItemUncheckedCreateInput = {
    id?: string
    requestId: string
    hawbGroupId?: string | null
    style: string
    so: string
    sub?: string | null
    customerPO?: string | null
    description?: string | null
    gmtType?: string | null
    originalShipmentDate?: Date | string | null
    planShipmentDate?: Date | string | null
    qtyOriginalShipment: number
    qtyRequestAir: number
    itemStatus?: string
    itemComment?: string | null
    reasonDelay: string
    factory: string
    country: string
    port: string
    grossWeight?: number | null
    airFreight?: number | null
    marketRatePerKg?: number | null
    actualAirFreight?: number | null
    claimDepartment?: string | null
    invoiceNo?: string | null
    hawbNo?: string | null
    bookingDate?: Date | string | null
    assignedDvm?: string | null
    claimPercentage?: number | null
    qtyActualShip?: number | null
    claimApprovals?: ClaimApprovalUncheckedCreateNestedManyWithoutItemInput
  }

  export type AirRequestItemUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    style?: StringFieldUpdateOperationsInput | string
    so?: StringFieldUpdateOperationsInput | string
    sub?: NullableStringFieldUpdateOperationsInput | string | null
    customerPO?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    gmtType?: NullableStringFieldUpdateOperationsInput | string | null
    originalShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    qtyOriginalShipment?: IntFieldUpdateOperationsInput | number
    qtyRequestAir?: IntFieldUpdateOperationsInput | number
    itemStatus?: StringFieldUpdateOperationsInput | string
    itemComment?: NullableStringFieldUpdateOperationsInput | string | null
    reasonDelay?: StringFieldUpdateOperationsInput | string
    factory?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    grossWeight?: NullableFloatFieldUpdateOperationsInput | number | null
    airFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    marketRatePerKg?: NullableFloatFieldUpdateOperationsInput | number | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    hawbNo?: NullableStringFieldUpdateOperationsInput | string | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedDvm?: NullableStringFieldUpdateOperationsInput | string | null
    claimPercentage?: NullableFloatFieldUpdateOperationsInput | number | null
    qtyActualShip?: NullableIntFieldUpdateOperationsInput | number | null
    request?: AirRequestUpdateOneRequiredWithoutItemsNestedInput
    hawbGroup?: HawbGroupUpdateOneWithoutItemsNestedInput
    claimApprovals?: ClaimApprovalUpdateManyWithoutItemNestedInput
  }

  export type AirRequestItemUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    hawbGroupId?: NullableStringFieldUpdateOperationsInput | string | null
    style?: StringFieldUpdateOperationsInput | string
    so?: StringFieldUpdateOperationsInput | string
    sub?: NullableStringFieldUpdateOperationsInput | string | null
    customerPO?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    gmtType?: NullableStringFieldUpdateOperationsInput | string | null
    originalShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    qtyOriginalShipment?: IntFieldUpdateOperationsInput | number
    qtyRequestAir?: IntFieldUpdateOperationsInput | number
    itemStatus?: StringFieldUpdateOperationsInput | string
    itemComment?: NullableStringFieldUpdateOperationsInput | string | null
    reasonDelay?: StringFieldUpdateOperationsInput | string
    factory?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    grossWeight?: NullableFloatFieldUpdateOperationsInput | number | null
    airFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    marketRatePerKg?: NullableFloatFieldUpdateOperationsInput | number | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    hawbNo?: NullableStringFieldUpdateOperationsInput | string | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedDvm?: NullableStringFieldUpdateOperationsInput | string | null
    claimPercentage?: NullableFloatFieldUpdateOperationsInput | number | null
    qtyActualShip?: NullableIntFieldUpdateOperationsInput | number | null
    claimApprovals?: ClaimApprovalUncheckedUpdateManyWithoutItemNestedInput
  }

  export type AirRequestItemCreateManyInput = {
    id?: string
    requestId: string
    hawbGroupId?: string | null
    style: string
    so: string
    sub?: string | null
    customerPO?: string | null
    description?: string | null
    gmtType?: string | null
    originalShipmentDate?: Date | string | null
    planShipmentDate?: Date | string | null
    qtyOriginalShipment: number
    qtyRequestAir: number
    itemStatus?: string
    itemComment?: string | null
    reasonDelay: string
    factory: string
    country: string
    port: string
    grossWeight?: number | null
    airFreight?: number | null
    marketRatePerKg?: number | null
    actualAirFreight?: number | null
    claimDepartment?: string | null
    invoiceNo?: string | null
    hawbNo?: string | null
    bookingDate?: Date | string | null
    assignedDvm?: string | null
    claimPercentage?: number | null
    qtyActualShip?: number | null
  }

  export type AirRequestItemUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    style?: StringFieldUpdateOperationsInput | string
    so?: StringFieldUpdateOperationsInput | string
    sub?: NullableStringFieldUpdateOperationsInput | string | null
    customerPO?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    gmtType?: NullableStringFieldUpdateOperationsInput | string | null
    originalShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    qtyOriginalShipment?: IntFieldUpdateOperationsInput | number
    qtyRequestAir?: IntFieldUpdateOperationsInput | number
    itemStatus?: StringFieldUpdateOperationsInput | string
    itemComment?: NullableStringFieldUpdateOperationsInput | string | null
    reasonDelay?: StringFieldUpdateOperationsInput | string
    factory?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    grossWeight?: NullableFloatFieldUpdateOperationsInput | number | null
    airFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    marketRatePerKg?: NullableFloatFieldUpdateOperationsInput | number | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    hawbNo?: NullableStringFieldUpdateOperationsInput | string | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedDvm?: NullableStringFieldUpdateOperationsInput | string | null
    claimPercentage?: NullableFloatFieldUpdateOperationsInput | number | null
    qtyActualShip?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type AirRequestItemUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    hawbGroupId?: NullableStringFieldUpdateOperationsInput | string | null
    style?: StringFieldUpdateOperationsInput | string
    so?: StringFieldUpdateOperationsInput | string
    sub?: NullableStringFieldUpdateOperationsInput | string | null
    customerPO?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    gmtType?: NullableStringFieldUpdateOperationsInput | string | null
    originalShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    qtyOriginalShipment?: IntFieldUpdateOperationsInput | number
    qtyRequestAir?: IntFieldUpdateOperationsInput | number
    itemStatus?: StringFieldUpdateOperationsInput | string
    itemComment?: NullableStringFieldUpdateOperationsInput | string | null
    reasonDelay?: StringFieldUpdateOperationsInput | string
    factory?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    grossWeight?: NullableFloatFieldUpdateOperationsInput | number | null
    airFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    marketRatePerKg?: NullableFloatFieldUpdateOperationsInput | number | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    hawbNo?: NullableStringFieldUpdateOperationsInput | string | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedDvm?: NullableStringFieldUpdateOperationsInput | string | null
    claimPercentage?: NullableFloatFieldUpdateOperationsInput | number | null
    qtyActualShip?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type ApprovalLogCreateInput = {
    id?: string
    action: string
    fromStatus: string
    toStatus: string
    comment?: string | null
    createdAt?: Date | string
    request: AirRequestCreateNestedOneWithoutApprovalLogsInput
    user: UserCreateNestedOneWithoutApprovalsInput
  }

  export type ApprovalLogUncheckedCreateInput = {
    id?: string
    requestId: string
    userId: string
    action: string
    fromStatus: string
    toStatus: string
    comment?: string | null
    createdAt?: Date | string
  }

  export type ApprovalLogUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    fromStatus?: StringFieldUpdateOperationsInput | string
    toStatus?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    request?: AirRequestUpdateOneRequiredWithoutApprovalLogsNestedInput
    user?: UserUpdateOneRequiredWithoutApprovalsNestedInput
  }

  export type ApprovalLogUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    fromStatus?: StringFieldUpdateOperationsInput | string
    toStatus?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ApprovalLogCreateManyInput = {
    id?: string
    requestId: string
    userId: string
    action: string
    fromStatus: string
    toStatus: string
    comment?: string | null
    createdAt?: Date | string
  }

  export type ApprovalLogUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    fromStatus?: StringFieldUpdateOperationsInput | string
    toStatus?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ApprovalLogUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    fromStatus?: StringFieldUpdateOperationsInput | string
    toStatus?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RequestAttachmentCreateInput = {
    id?: string
    itemId?: string | null
    fileName: string
    filePath: string
    fileSize: number
    mimeType: string
    claimDept?: string | null
    createdAt?: Date | string
    request: AirRequestCreateNestedOneWithoutAttachmentsInput
    uploadedBy: UserCreateNestedOneWithoutAttachmentsInput
  }

  export type RequestAttachmentUncheckedCreateInput = {
    id?: string
    requestId: string
    itemId?: string | null
    uploadedById: string
    fileName: string
    filePath: string
    fileSize: number
    mimeType: string
    claimDept?: string | null
    createdAt?: Date | string
  }

  export type RequestAttachmentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    itemId?: NullableStringFieldUpdateOperationsInput | string | null
    fileName?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileSize?: IntFieldUpdateOperationsInput | number
    mimeType?: StringFieldUpdateOperationsInput | string
    claimDept?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    request?: AirRequestUpdateOneRequiredWithoutAttachmentsNestedInput
    uploadedBy?: UserUpdateOneRequiredWithoutAttachmentsNestedInput
  }

  export type RequestAttachmentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    itemId?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedById?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileSize?: IntFieldUpdateOperationsInput | number
    mimeType?: StringFieldUpdateOperationsInput | string
    claimDept?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RequestAttachmentCreateManyInput = {
    id?: string
    requestId: string
    itemId?: string | null
    uploadedById: string
    fileName: string
    filePath: string
    fileSize: number
    mimeType: string
    claimDept?: string | null
    createdAt?: Date | string
  }

  export type RequestAttachmentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    itemId?: NullableStringFieldUpdateOperationsInput | string | null
    fileName?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileSize?: IntFieldUpdateOperationsInput | number
    mimeType?: StringFieldUpdateOperationsInput | string
    claimDept?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RequestAttachmentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    itemId?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedById?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileSize?: IntFieldUpdateOperationsInput | number
    mimeType?: StringFieldUpdateOperationsInput | string
    claimDept?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type AirRequestListRelationFilter = {
    every?: AirRequestWhereInput
    some?: AirRequestWhereInput
    none?: AirRequestWhereInput
  }

  export type ApprovalLogListRelationFilter = {
    every?: ApprovalLogWhereInput
    some?: ApprovalLogWhereInput
    none?: ApprovalLogWhereInput
  }

  export type ClaimApprovalListRelationFilter = {
    every?: ClaimApprovalWhereInput
    some?: ClaimApprovalWhereInput
    none?: ClaimApprovalWhereInput
  }

  export type RequestAttachmentListRelationFilter = {
    every?: RequestAttachmentWhereInput
    some?: RequestAttachmentWhereInput
    none?: RequestAttachmentWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type AirRequestOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ApprovalLogOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ClaimApprovalOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type RequestAttachmentOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    password?: SortOrder
    role?: SortOrder
    claimDepartment?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    priority?: SortOrder
    bu?: SortOrder
    procurementType?: SortOrder
    resetToken?: SortOrder
    resetTokenExpiry?: SortOrder
  }

  export type UserAvgOrderByAggregateInput = {
    priority?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    password?: SortOrder
    role?: SortOrder
    claimDepartment?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    priority?: SortOrder
    bu?: SortOrder
    procurementType?: SortOrder
    resetToken?: SortOrder
    resetTokenExpiry?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    password?: SortOrder
    role?: SortOrder
    claimDepartment?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    priority?: SortOrder
    bu?: SortOrder
    procurementType?: SortOrder
    resetToken?: SortOrder
    resetTokenExpiry?: SortOrder
  }

  export type UserSumOrderByAggregateInput = {
    priority?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type MasterBrandCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
  }

  export type MasterBrandMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
  }

  export type MasterBrandMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
  }

  export type MasterBUCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
  }

  export type MasterBUMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
  }

  export type MasterBUMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type MasterDescriptionCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    weightPerUnit?: SortOrder
    isActive?: SortOrder
  }

  export type MasterDescriptionAvgOrderByAggregateInput = {
    weightPerUnit?: SortOrder
  }

  export type MasterDescriptionMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    weightPerUnit?: SortOrder
    isActive?: SortOrder
  }

  export type MasterDescriptionMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    weightPerUnit?: SortOrder
    isActive?: SortOrder
  }

  export type MasterDescriptionSumOrderByAggregateInput = {
    weightPerUnit?: SortOrder
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type MasterGMTTypeCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
  }

  export type MasterGMTTypeMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
  }

  export type MasterGMTTypeMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
  }

  export type MasterPortCountOrderByAggregateInput = {
    id?: SortOrder
    country?: SortOrder
    port?: SortOrder
    ratePerKg?: SortOrder
    isActive?: SortOrder
    updatedAt?: SortOrder
  }

  export type MasterPortAvgOrderByAggregateInput = {
    ratePerKg?: SortOrder
  }

  export type MasterPortMaxOrderByAggregateInput = {
    id?: SortOrder
    country?: SortOrder
    port?: SortOrder
    ratePerKg?: SortOrder
    isActive?: SortOrder
    updatedAt?: SortOrder
  }

  export type MasterPortMinOrderByAggregateInput = {
    id?: SortOrder
    country?: SortOrder
    port?: SortOrder
    ratePerKg?: SortOrder
    isActive?: SortOrder
    updatedAt?: SortOrder
  }

  export type MasterPortSumOrderByAggregateInput = {
    ratePerKg?: SortOrder
  }

  export type FloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type UserRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type AirRequestItemListRelationFilter = {
    every?: AirRequestItemWhereInput
    some?: AirRequestItemWhereInput
    none?: AirRequestItemWhereInput
  }

  export type HawbGroupListRelationFilter = {
    every?: HawbGroupWhereInput
    some?: HawbGroupWhereInput
    none?: HawbGroupWhereInput
  }

  export type AirRequestItemOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type HawbGroupOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type AirRequestCountOrderByAggregateInput = {
    id?: SortOrder
    documentNo?: SortOrder
    brandName?: SortOrder
    buName?: SortOrder
    status?: SortOrder
    claimDepartment?: SortOrder
    rejectionReason?: SortOrder
    createdById?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    invoiceNo?: SortOrder
    actualAirFreight?: SortOrder
    bookingDate?: SortOrder
    airline?: SortOrder
    assignedVpMer?: SortOrder
    vpMerToken?: SortOrder
    presidentToken?: SortOrder
    scmToken?: SortOrder
    vpScmToken?: SortOrder
    assignedVpScm?: SortOrder
    logisticsToken?: SortOrder
    accountingToken?: SortOrder
    claimNextEmail?: SortOrder
    claimNextToken?: SortOrder
    claimNextName?: SortOrder
    bu?: SortOrder
  }

  export type AirRequestAvgOrderByAggregateInput = {
    actualAirFreight?: SortOrder
  }

  export type AirRequestMaxOrderByAggregateInput = {
    id?: SortOrder
    documentNo?: SortOrder
    brandName?: SortOrder
    buName?: SortOrder
    status?: SortOrder
    claimDepartment?: SortOrder
    rejectionReason?: SortOrder
    createdById?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    invoiceNo?: SortOrder
    actualAirFreight?: SortOrder
    bookingDate?: SortOrder
    airline?: SortOrder
    assignedVpMer?: SortOrder
    vpMerToken?: SortOrder
    presidentToken?: SortOrder
    scmToken?: SortOrder
    vpScmToken?: SortOrder
    assignedVpScm?: SortOrder
    logisticsToken?: SortOrder
    accountingToken?: SortOrder
    claimNextEmail?: SortOrder
    claimNextToken?: SortOrder
    claimNextName?: SortOrder
    bu?: SortOrder
  }

  export type AirRequestMinOrderByAggregateInput = {
    id?: SortOrder
    documentNo?: SortOrder
    brandName?: SortOrder
    buName?: SortOrder
    status?: SortOrder
    claimDepartment?: SortOrder
    rejectionReason?: SortOrder
    createdById?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    invoiceNo?: SortOrder
    actualAirFreight?: SortOrder
    bookingDate?: SortOrder
    airline?: SortOrder
    assignedVpMer?: SortOrder
    vpMerToken?: SortOrder
    presidentToken?: SortOrder
    scmToken?: SortOrder
    vpScmToken?: SortOrder
    assignedVpScm?: SortOrder
    logisticsToken?: SortOrder
    accountingToken?: SortOrder
    claimNextEmail?: SortOrder
    claimNextToken?: SortOrder
    claimNextName?: SortOrder
    bu?: SortOrder
  }

  export type AirRequestSumOrderByAggregateInput = {
    actualAirFreight?: SortOrder
  }

  export type FloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type AirRequestItemRelationFilter = {
    is?: AirRequestItemWhereInput
    isNot?: AirRequestItemWhereInput
  }

  export type ClaimApprovalItemIdUserIdCompoundUniqueInput = {
    itemId: string
    userId: string
  }

  export type ClaimApprovalCountOrderByAggregateInput = {
    id?: SortOrder
    itemId?: SortOrder
    userId?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
  }

  export type ClaimApprovalMaxOrderByAggregateInput = {
    id?: SortOrder
    itemId?: SortOrder
    userId?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
  }

  export type ClaimApprovalMinOrderByAggregateInput = {
    id?: SortOrder
    itemId?: SortOrder
    userId?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
  }

  export type AirRequestRelationFilter = {
    is?: AirRequestWhereInput
    isNot?: AirRequestWhereInput
  }

  export type HawbGroupCountOrderByAggregateInput = {
    id?: SortOrder
    requestId?: SortOrder
    hawbNo?: SortOrder
    totalCharge?: SortOrder
    createdAt?: SortOrder
  }

  export type HawbGroupAvgOrderByAggregateInput = {
    totalCharge?: SortOrder
  }

  export type HawbGroupMaxOrderByAggregateInput = {
    id?: SortOrder
    requestId?: SortOrder
    hawbNo?: SortOrder
    totalCharge?: SortOrder
    createdAt?: SortOrder
  }

  export type HawbGroupMinOrderByAggregateInput = {
    id?: SortOrder
    requestId?: SortOrder
    hawbNo?: SortOrder
    totalCharge?: SortOrder
    createdAt?: SortOrder
  }

  export type HawbGroupSumOrderByAggregateInput = {
    totalCharge?: SortOrder
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type HawbGroupNullableRelationFilter = {
    is?: HawbGroupWhereInput | null
    isNot?: HawbGroupWhereInput | null
  }

  export type AirRequestItemCountOrderByAggregateInput = {
    id?: SortOrder
    requestId?: SortOrder
    hawbGroupId?: SortOrder
    style?: SortOrder
    so?: SortOrder
    sub?: SortOrder
    customerPO?: SortOrder
    description?: SortOrder
    gmtType?: SortOrder
    originalShipmentDate?: SortOrder
    planShipmentDate?: SortOrder
    qtyOriginalShipment?: SortOrder
    qtyRequestAir?: SortOrder
    itemStatus?: SortOrder
    itemComment?: SortOrder
    reasonDelay?: SortOrder
    factory?: SortOrder
    country?: SortOrder
    port?: SortOrder
    grossWeight?: SortOrder
    airFreight?: SortOrder
    marketRatePerKg?: SortOrder
    actualAirFreight?: SortOrder
    claimDepartment?: SortOrder
    invoiceNo?: SortOrder
    hawbNo?: SortOrder
    bookingDate?: SortOrder
    assignedDvm?: SortOrder
    claimPercentage?: SortOrder
    qtyActualShip?: SortOrder
  }

  export type AirRequestItemAvgOrderByAggregateInput = {
    qtyOriginalShipment?: SortOrder
    qtyRequestAir?: SortOrder
    grossWeight?: SortOrder
    airFreight?: SortOrder
    marketRatePerKg?: SortOrder
    actualAirFreight?: SortOrder
    claimPercentage?: SortOrder
    qtyActualShip?: SortOrder
  }

  export type AirRequestItemMaxOrderByAggregateInput = {
    id?: SortOrder
    requestId?: SortOrder
    hawbGroupId?: SortOrder
    style?: SortOrder
    so?: SortOrder
    sub?: SortOrder
    customerPO?: SortOrder
    description?: SortOrder
    gmtType?: SortOrder
    originalShipmentDate?: SortOrder
    planShipmentDate?: SortOrder
    qtyOriginalShipment?: SortOrder
    qtyRequestAir?: SortOrder
    itemStatus?: SortOrder
    itemComment?: SortOrder
    reasonDelay?: SortOrder
    factory?: SortOrder
    country?: SortOrder
    port?: SortOrder
    grossWeight?: SortOrder
    airFreight?: SortOrder
    marketRatePerKg?: SortOrder
    actualAirFreight?: SortOrder
    claimDepartment?: SortOrder
    invoiceNo?: SortOrder
    hawbNo?: SortOrder
    bookingDate?: SortOrder
    assignedDvm?: SortOrder
    claimPercentage?: SortOrder
    qtyActualShip?: SortOrder
  }

  export type AirRequestItemMinOrderByAggregateInput = {
    id?: SortOrder
    requestId?: SortOrder
    hawbGroupId?: SortOrder
    style?: SortOrder
    so?: SortOrder
    sub?: SortOrder
    customerPO?: SortOrder
    description?: SortOrder
    gmtType?: SortOrder
    originalShipmentDate?: SortOrder
    planShipmentDate?: SortOrder
    qtyOriginalShipment?: SortOrder
    qtyRequestAir?: SortOrder
    itemStatus?: SortOrder
    itemComment?: SortOrder
    reasonDelay?: SortOrder
    factory?: SortOrder
    country?: SortOrder
    port?: SortOrder
    grossWeight?: SortOrder
    airFreight?: SortOrder
    marketRatePerKg?: SortOrder
    actualAirFreight?: SortOrder
    claimDepartment?: SortOrder
    invoiceNo?: SortOrder
    hawbNo?: SortOrder
    bookingDate?: SortOrder
    assignedDvm?: SortOrder
    claimPercentage?: SortOrder
    qtyActualShip?: SortOrder
  }

  export type AirRequestItemSumOrderByAggregateInput = {
    qtyOriginalShipment?: SortOrder
    qtyRequestAir?: SortOrder
    grossWeight?: SortOrder
    airFreight?: SortOrder
    marketRatePerKg?: SortOrder
    actualAirFreight?: SortOrder
    claimPercentage?: SortOrder
    qtyActualShip?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type ApprovalLogCountOrderByAggregateInput = {
    id?: SortOrder
    requestId?: SortOrder
    userId?: SortOrder
    action?: SortOrder
    fromStatus?: SortOrder
    toStatus?: SortOrder
    comment?: SortOrder
    createdAt?: SortOrder
  }

  export type ApprovalLogMaxOrderByAggregateInput = {
    id?: SortOrder
    requestId?: SortOrder
    userId?: SortOrder
    action?: SortOrder
    fromStatus?: SortOrder
    toStatus?: SortOrder
    comment?: SortOrder
    createdAt?: SortOrder
  }

  export type ApprovalLogMinOrderByAggregateInput = {
    id?: SortOrder
    requestId?: SortOrder
    userId?: SortOrder
    action?: SortOrder
    fromStatus?: SortOrder
    toStatus?: SortOrder
    comment?: SortOrder
    createdAt?: SortOrder
  }

  export type RequestAttachmentCountOrderByAggregateInput = {
    id?: SortOrder
    requestId?: SortOrder
    itemId?: SortOrder
    uploadedById?: SortOrder
    fileName?: SortOrder
    filePath?: SortOrder
    fileSize?: SortOrder
    mimeType?: SortOrder
    claimDept?: SortOrder
    createdAt?: SortOrder
  }

  export type RequestAttachmentAvgOrderByAggregateInput = {
    fileSize?: SortOrder
  }

  export type RequestAttachmentMaxOrderByAggregateInput = {
    id?: SortOrder
    requestId?: SortOrder
    itemId?: SortOrder
    uploadedById?: SortOrder
    fileName?: SortOrder
    filePath?: SortOrder
    fileSize?: SortOrder
    mimeType?: SortOrder
    claimDept?: SortOrder
    createdAt?: SortOrder
  }

  export type RequestAttachmentMinOrderByAggregateInput = {
    id?: SortOrder
    requestId?: SortOrder
    itemId?: SortOrder
    uploadedById?: SortOrder
    fileName?: SortOrder
    filePath?: SortOrder
    fileSize?: SortOrder
    mimeType?: SortOrder
    claimDept?: SortOrder
    createdAt?: SortOrder
  }

  export type RequestAttachmentSumOrderByAggregateInput = {
    fileSize?: SortOrder
  }

  export type AirRequestCreateNestedManyWithoutCreatedByInput = {
    create?: XOR<AirRequestCreateWithoutCreatedByInput, AirRequestUncheckedCreateWithoutCreatedByInput> | AirRequestCreateWithoutCreatedByInput[] | AirRequestUncheckedCreateWithoutCreatedByInput[]
    connectOrCreate?: AirRequestCreateOrConnectWithoutCreatedByInput | AirRequestCreateOrConnectWithoutCreatedByInput[]
    createMany?: AirRequestCreateManyCreatedByInputEnvelope
    connect?: AirRequestWhereUniqueInput | AirRequestWhereUniqueInput[]
  }

  export type ApprovalLogCreateNestedManyWithoutUserInput = {
    create?: XOR<ApprovalLogCreateWithoutUserInput, ApprovalLogUncheckedCreateWithoutUserInput> | ApprovalLogCreateWithoutUserInput[] | ApprovalLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ApprovalLogCreateOrConnectWithoutUserInput | ApprovalLogCreateOrConnectWithoutUserInput[]
    createMany?: ApprovalLogCreateManyUserInputEnvelope
    connect?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
  }

  export type ClaimApprovalCreateNestedManyWithoutUserInput = {
    create?: XOR<ClaimApprovalCreateWithoutUserInput, ClaimApprovalUncheckedCreateWithoutUserInput> | ClaimApprovalCreateWithoutUserInput[] | ClaimApprovalUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ClaimApprovalCreateOrConnectWithoutUserInput | ClaimApprovalCreateOrConnectWithoutUserInput[]
    createMany?: ClaimApprovalCreateManyUserInputEnvelope
    connect?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
  }

  export type RequestAttachmentCreateNestedManyWithoutUploadedByInput = {
    create?: XOR<RequestAttachmentCreateWithoutUploadedByInput, RequestAttachmentUncheckedCreateWithoutUploadedByInput> | RequestAttachmentCreateWithoutUploadedByInput[] | RequestAttachmentUncheckedCreateWithoutUploadedByInput[]
    connectOrCreate?: RequestAttachmentCreateOrConnectWithoutUploadedByInput | RequestAttachmentCreateOrConnectWithoutUploadedByInput[]
    createMany?: RequestAttachmentCreateManyUploadedByInputEnvelope
    connect?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
  }

  export type AirRequestUncheckedCreateNestedManyWithoutCreatedByInput = {
    create?: XOR<AirRequestCreateWithoutCreatedByInput, AirRequestUncheckedCreateWithoutCreatedByInput> | AirRequestCreateWithoutCreatedByInput[] | AirRequestUncheckedCreateWithoutCreatedByInput[]
    connectOrCreate?: AirRequestCreateOrConnectWithoutCreatedByInput | AirRequestCreateOrConnectWithoutCreatedByInput[]
    createMany?: AirRequestCreateManyCreatedByInputEnvelope
    connect?: AirRequestWhereUniqueInput | AirRequestWhereUniqueInput[]
  }

  export type ApprovalLogUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<ApprovalLogCreateWithoutUserInput, ApprovalLogUncheckedCreateWithoutUserInput> | ApprovalLogCreateWithoutUserInput[] | ApprovalLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ApprovalLogCreateOrConnectWithoutUserInput | ApprovalLogCreateOrConnectWithoutUserInput[]
    createMany?: ApprovalLogCreateManyUserInputEnvelope
    connect?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
  }

  export type ClaimApprovalUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<ClaimApprovalCreateWithoutUserInput, ClaimApprovalUncheckedCreateWithoutUserInput> | ClaimApprovalCreateWithoutUserInput[] | ClaimApprovalUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ClaimApprovalCreateOrConnectWithoutUserInput | ClaimApprovalCreateOrConnectWithoutUserInput[]
    createMany?: ClaimApprovalCreateManyUserInputEnvelope
    connect?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
  }

  export type RequestAttachmentUncheckedCreateNestedManyWithoutUploadedByInput = {
    create?: XOR<RequestAttachmentCreateWithoutUploadedByInput, RequestAttachmentUncheckedCreateWithoutUploadedByInput> | RequestAttachmentCreateWithoutUploadedByInput[] | RequestAttachmentUncheckedCreateWithoutUploadedByInput[]
    connectOrCreate?: RequestAttachmentCreateOrConnectWithoutUploadedByInput | RequestAttachmentCreateOrConnectWithoutUploadedByInput[]
    createMany?: RequestAttachmentCreateManyUploadedByInputEnvelope
    connect?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type AirRequestUpdateManyWithoutCreatedByNestedInput = {
    create?: XOR<AirRequestCreateWithoutCreatedByInput, AirRequestUncheckedCreateWithoutCreatedByInput> | AirRequestCreateWithoutCreatedByInput[] | AirRequestUncheckedCreateWithoutCreatedByInput[]
    connectOrCreate?: AirRequestCreateOrConnectWithoutCreatedByInput | AirRequestCreateOrConnectWithoutCreatedByInput[]
    upsert?: AirRequestUpsertWithWhereUniqueWithoutCreatedByInput | AirRequestUpsertWithWhereUniqueWithoutCreatedByInput[]
    createMany?: AirRequestCreateManyCreatedByInputEnvelope
    set?: AirRequestWhereUniqueInput | AirRequestWhereUniqueInput[]
    disconnect?: AirRequestWhereUniqueInput | AirRequestWhereUniqueInput[]
    delete?: AirRequestWhereUniqueInput | AirRequestWhereUniqueInput[]
    connect?: AirRequestWhereUniqueInput | AirRequestWhereUniqueInput[]
    update?: AirRequestUpdateWithWhereUniqueWithoutCreatedByInput | AirRequestUpdateWithWhereUniqueWithoutCreatedByInput[]
    updateMany?: AirRequestUpdateManyWithWhereWithoutCreatedByInput | AirRequestUpdateManyWithWhereWithoutCreatedByInput[]
    deleteMany?: AirRequestScalarWhereInput | AirRequestScalarWhereInput[]
  }

  export type ApprovalLogUpdateManyWithoutUserNestedInput = {
    create?: XOR<ApprovalLogCreateWithoutUserInput, ApprovalLogUncheckedCreateWithoutUserInput> | ApprovalLogCreateWithoutUserInput[] | ApprovalLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ApprovalLogCreateOrConnectWithoutUserInput | ApprovalLogCreateOrConnectWithoutUserInput[]
    upsert?: ApprovalLogUpsertWithWhereUniqueWithoutUserInput | ApprovalLogUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ApprovalLogCreateManyUserInputEnvelope
    set?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    disconnect?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    delete?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    connect?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    update?: ApprovalLogUpdateWithWhereUniqueWithoutUserInput | ApprovalLogUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ApprovalLogUpdateManyWithWhereWithoutUserInput | ApprovalLogUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ApprovalLogScalarWhereInput | ApprovalLogScalarWhereInput[]
  }

  export type ClaimApprovalUpdateManyWithoutUserNestedInput = {
    create?: XOR<ClaimApprovalCreateWithoutUserInput, ClaimApprovalUncheckedCreateWithoutUserInput> | ClaimApprovalCreateWithoutUserInput[] | ClaimApprovalUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ClaimApprovalCreateOrConnectWithoutUserInput | ClaimApprovalCreateOrConnectWithoutUserInput[]
    upsert?: ClaimApprovalUpsertWithWhereUniqueWithoutUserInput | ClaimApprovalUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ClaimApprovalCreateManyUserInputEnvelope
    set?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    disconnect?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    delete?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    connect?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    update?: ClaimApprovalUpdateWithWhereUniqueWithoutUserInput | ClaimApprovalUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ClaimApprovalUpdateManyWithWhereWithoutUserInput | ClaimApprovalUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ClaimApprovalScalarWhereInput | ClaimApprovalScalarWhereInput[]
  }

  export type RequestAttachmentUpdateManyWithoutUploadedByNestedInput = {
    create?: XOR<RequestAttachmentCreateWithoutUploadedByInput, RequestAttachmentUncheckedCreateWithoutUploadedByInput> | RequestAttachmentCreateWithoutUploadedByInput[] | RequestAttachmentUncheckedCreateWithoutUploadedByInput[]
    connectOrCreate?: RequestAttachmentCreateOrConnectWithoutUploadedByInput | RequestAttachmentCreateOrConnectWithoutUploadedByInput[]
    upsert?: RequestAttachmentUpsertWithWhereUniqueWithoutUploadedByInput | RequestAttachmentUpsertWithWhereUniqueWithoutUploadedByInput[]
    createMany?: RequestAttachmentCreateManyUploadedByInputEnvelope
    set?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    disconnect?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    delete?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    connect?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    update?: RequestAttachmentUpdateWithWhereUniqueWithoutUploadedByInput | RequestAttachmentUpdateWithWhereUniqueWithoutUploadedByInput[]
    updateMany?: RequestAttachmentUpdateManyWithWhereWithoutUploadedByInput | RequestAttachmentUpdateManyWithWhereWithoutUploadedByInput[]
    deleteMany?: RequestAttachmentScalarWhereInput | RequestAttachmentScalarWhereInput[]
  }

  export type AirRequestUncheckedUpdateManyWithoutCreatedByNestedInput = {
    create?: XOR<AirRequestCreateWithoutCreatedByInput, AirRequestUncheckedCreateWithoutCreatedByInput> | AirRequestCreateWithoutCreatedByInput[] | AirRequestUncheckedCreateWithoutCreatedByInput[]
    connectOrCreate?: AirRequestCreateOrConnectWithoutCreatedByInput | AirRequestCreateOrConnectWithoutCreatedByInput[]
    upsert?: AirRequestUpsertWithWhereUniqueWithoutCreatedByInput | AirRequestUpsertWithWhereUniqueWithoutCreatedByInput[]
    createMany?: AirRequestCreateManyCreatedByInputEnvelope
    set?: AirRequestWhereUniqueInput | AirRequestWhereUniqueInput[]
    disconnect?: AirRequestWhereUniqueInput | AirRequestWhereUniqueInput[]
    delete?: AirRequestWhereUniqueInput | AirRequestWhereUniqueInput[]
    connect?: AirRequestWhereUniqueInput | AirRequestWhereUniqueInput[]
    update?: AirRequestUpdateWithWhereUniqueWithoutCreatedByInput | AirRequestUpdateWithWhereUniqueWithoutCreatedByInput[]
    updateMany?: AirRequestUpdateManyWithWhereWithoutCreatedByInput | AirRequestUpdateManyWithWhereWithoutCreatedByInput[]
    deleteMany?: AirRequestScalarWhereInput | AirRequestScalarWhereInput[]
  }

  export type ApprovalLogUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<ApprovalLogCreateWithoutUserInput, ApprovalLogUncheckedCreateWithoutUserInput> | ApprovalLogCreateWithoutUserInput[] | ApprovalLogUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ApprovalLogCreateOrConnectWithoutUserInput | ApprovalLogCreateOrConnectWithoutUserInput[]
    upsert?: ApprovalLogUpsertWithWhereUniqueWithoutUserInput | ApprovalLogUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ApprovalLogCreateManyUserInputEnvelope
    set?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    disconnect?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    delete?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    connect?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    update?: ApprovalLogUpdateWithWhereUniqueWithoutUserInput | ApprovalLogUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ApprovalLogUpdateManyWithWhereWithoutUserInput | ApprovalLogUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ApprovalLogScalarWhereInput | ApprovalLogScalarWhereInput[]
  }

  export type ClaimApprovalUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<ClaimApprovalCreateWithoutUserInput, ClaimApprovalUncheckedCreateWithoutUserInput> | ClaimApprovalCreateWithoutUserInput[] | ClaimApprovalUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ClaimApprovalCreateOrConnectWithoutUserInput | ClaimApprovalCreateOrConnectWithoutUserInput[]
    upsert?: ClaimApprovalUpsertWithWhereUniqueWithoutUserInput | ClaimApprovalUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ClaimApprovalCreateManyUserInputEnvelope
    set?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    disconnect?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    delete?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    connect?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    update?: ClaimApprovalUpdateWithWhereUniqueWithoutUserInput | ClaimApprovalUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ClaimApprovalUpdateManyWithWhereWithoutUserInput | ClaimApprovalUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ClaimApprovalScalarWhereInput | ClaimApprovalScalarWhereInput[]
  }

  export type RequestAttachmentUncheckedUpdateManyWithoutUploadedByNestedInput = {
    create?: XOR<RequestAttachmentCreateWithoutUploadedByInput, RequestAttachmentUncheckedCreateWithoutUploadedByInput> | RequestAttachmentCreateWithoutUploadedByInput[] | RequestAttachmentUncheckedCreateWithoutUploadedByInput[]
    connectOrCreate?: RequestAttachmentCreateOrConnectWithoutUploadedByInput | RequestAttachmentCreateOrConnectWithoutUploadedByInput[]
    upsert?: RequestAttachmentUpsertWithWhereUniqueWithoutUploadedByInput | RequestAttachmentUpsertWithWhereUniqueWithoutUploadedByInput[]
    createMany?: RequestAttachmentCreateManyUploadedByInputEnvelope
    set?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    disconnect?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    delete?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    connect?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    update?: RequestAttachmentUpdateWithWhereUniqueWithoutUploadedByInput | RequestAttachmentUpdateWithWhereUniqueWithoutUploadedByInput[]
    updateMany?: RequestAttachmentUpdateManyWithWhereWithoutUploadedByInput | RequestAttachmentUpdateManyWithWhereWithoutUploadedByInput[]
    deleteMany?: RequestAttachmentScalarWhereInput | RequestAttachmentScalarWhereInput[]
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type UserCreateNestedOneWithoutAirRequestsInput = {
    create?: XOR<UserCreateWithoutAirRequestsInput, UserUncheckedCreateWithoutAirRequestsInput>
    connectOrCreate?: UserCreateOrConnectWithoutAirRequestsInput
    connect?: UserWhereUniqueInput
  }

  export type AirRequestItemCreateNestedManyWithoutRequestInput = {
    create?: XOR<AirRequestItemCreateWithoutRequestInput, AirRequestItemUncheckedCreateWithoutRequestInput> | AirRequestItemCreateWithoutRequestInput[] | AirRequestItemUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: AirRequestItemCreateOrConnectWithoutRequestInput | AirRequestItemCreateOrConnectWithoutRequestInput[]
    createMany?: AirRequestItemCreateManyRequestInputEnvelope
    connect?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
  }

  export type ApprovalLogCreateNestedManyWithoutRequestInput = {
    create?: XOR<ApprovalLogCreateWithoutRequestInput, ApprovalLogUncheckedCreateWithoutRequestInput> | ApprovalLogCreateWithoutRequestInput[] | ApprovalLogUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: ApprovalLogCreateOrConnectWithoutRequestInput | ApprovalLogCreateOrConnectWithoutRequestInput[]
    createMany?: ApprovalLogCreateManyRequestInputEnvelope
    connect?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
  }

  export type RequestAttachmentCreateNestedManyWithoutRequestInput = {
    create?: XOR<RequestAttachmentCreateWithoutRequestInput, RequestAttachmentUncheckedCreateWithoutRequestInput> | RequestAttachmentCreateWithoutRequestInput[] | RequestAttachmentUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: RequestAttachmentCreateOrConnectWithoutRequestInput | RequestAttachmentCreateOrConnectWithoutRequestInput[]
    createMany?: RequestAttachmentCreateManyRequestInputEnvelope
    connect?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
  }

  export type HawbGroupCreateNestedManyWithoutRequestInput = {
    create?: XOR<HawbGroupCreateWithoutRequestInput, HawbGroupUncheckedCreateWithoutRequestInput> | HawbGroupCreateWithoutRequestInput[] | HawbGroupUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: HawbGroupCreateOrConnectWithoutRequestInput | HawbGroupCreateOrConnectWithoutRequestInput[]
    createMany?: HawbGroupCreateManyRequestInputEnvelope
    connect?: HawbGroupWhereUniqueInput | HawbGroupWhereUniqueInput[]
  }

  export type AirRequestItemUncheckedCreateNestedManyWithoutRequestInput = {
    create?: XOR<AirRequestItemCreateWithoutRequestInput, AirRequestItemUncheckedCreateWithoutRequestInput> | AirRequestItemCreateWithoutRequestInput[] | AirRequestItemUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: AirRequestItemCreateOrConnectWithoutRequestInput | AirRequestItemCreateOrConnectWithoutRequestInput[]
    createMany?: AirRequestItemCreateManyRequestInputEnvelope
    connect?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
  }

  export type ApprovalLogUncheckedCreateNestedManyWithoutRequestInput = {
    create?: XOR<ApprovalLogCreateWithoutRequestInput, ApprovalLogUncheckedCreateWithoutRequestInput> | ApprovalLogCreateWithoutRequestInput[] | ApprovalLogUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: ApprovalLogCreateOrConnectWithoutRequestInput | ApprovalLogCreateOrConnectWithoutRequestInput[]
    createMany?: ApprovalLogCreateManyRequestInputEnvelope
    connect?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
  }

  export type RequestAttachmentUncheckedCreateNestedManyWithoutRequestInput = {
    create?: XOR<RequestAttachmentCreateWithoutRequestInput, RequestAttachmentUncheckedCreateWithoutRequestInput> | RequestAttachmentCreateWithoutRequestInput[] | RequestAttachmentUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: RequestAttachmentCreateOrConnectWithoutRequestInput | RequestAttachmentCreateOrConnectWithoutRequestInput[]
    createMany?: RequestAttachmentCreateManyRequestInputEnvelope
    connect?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
  }

  export type HawbGroupUncheckedCreateNestedManyWithoutRequestInput = {
    create?: XOR<HawbGroupCreateWithoutRequestInput, HawbGroupUncheckedCreateWithoutRequestInput> | HawbGroupCreateWithoutRequestInput[] | HawbGroupUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: HawbGroupCreateOrConnectWithoutRequestInput | HawbGroupCreateOrConnectWithoutRequestInput[]
    createMany?: HawbGroupCreateManyRequestInputEnvelope
    connect?: HawbGroupWhereUniqueInput | HawbGroupWhereUniqueInput[]
  }

  export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type UserUpdateOneRequiredWithoutAirRequestsNestedInput = {
    create?: XOR<UserCreateWithoutAirRequestsInput, UserUncheckedCreateWithoutAirRequestsInput>
    connectOrCreate?: UserCreateOrConnectWithoutAirRequestsInput
    upsert?: UserUpsertWithoutAirRequestsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutAirRequestsInput, UserUpdateWithoutAirRequestsInput>, UserUncheckedUpdateWithoutAirRequestsInput>
  }

  export type AirRequestItemUpdateManyWithoutRequestNestedInput = {
    create?: XOR<AirRequestItemCreateWithoutRequestInput, AirRequestItemUncheckedCreateWithoutRequestInput> | AirRequestItemCreateWithoutRequestInput[] | AirRequestItemUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: AirRequestItemCreateOrConnectWithoutRequestInput | AirRequestItemCreateOrConnectWithoutRequestInput[]
    upsert?: AirRequestItemUpsertWithWhereUniqueWithoutRequestInput | AirRequestItemUpsertWithWhereUniqueWithoutRequestInput[]
    createMany?: AirRequestItemCreateManyRequestInputEnvelope
    set?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    disconnect?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    delete?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    connect?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    update?: AirRequestItemUpdateWithWhereUniqueWithoutRequestInput | AirRequestItemUpdateWithWhereUniqueWithoutRequestInput[]
    updateMany?: AirRequestItemUpdateManyWithWhereWithoutRequestInput | AirRequestItemUpdateManyWithWhereWithoutRequestInput[]
    deleteMany?: AirRequestItemScalarWhereInput | AirRequestItemScalarWhereInput[]
  }

  export type ApprovalLogUpdateManyWithoutRequestNestedInput = {
    create?: XOR<ApprovalLogCreateWithoutRequestInput, ApprovalLogUncheckedCreateWithoutRequestInput> | ApprovalLogCreateWithoutRequestInput[] | ApprovalLogUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: ApprovalLogCreateOrConnectWithoutRequestInput | ApprovalLogCreateOrConnectWithoutRequestInput[]
    upsert?: ApprovalLogUpsertWithWhereUniqueWithoutRequestInput | ApprovalLogUpsertWithWhereUniqueWithoutRequestInput[]
    createMany?: ApprovalLogCreateManyRequestInputEnvelope
    set?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    disconnect?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    delete?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    connect?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    update?: ApprovalLogUpdateWithWhereUniqueWithoutRequestInput | ApprovalLogUpdateWithWhereUniqueWithoutRequestInput[]
    updateMany?: ApprovalLogUpdateManyWithWhereWithoutRequestInput | ApprovalLogUpdateManyWithWhereWithoutRequestInput[]
    deleteMany?: ApprovalLogScalarWhereInput | ApprovalLogScalarWhereInput[]
  }

  export type RequestAttachmentUpdateManyWithoutRequestNestedInput = {
    create?: XOR<RequestAttachmentCreateWithoutRequestInput, RequestAttachmentUncheckedCreateWithoutRequestInput> | RequestAttachmentCreateWithoutRequestInput[] | RequestAttachmentUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: RequestAttachmentCreateOrConnectWithoutRequestInput | RequestAttachmentCreateOrConnectWithoutRequestInput[]
    upsert?: RequestAttachmentUpsertWithWhereUniqueWithoutRequestInput | RequestAttachmentUpsertWithWhereUniqueWithoutRequestInput[]
    createMany?: RequestAttachmentCreateManyRequestInputEnvelope
    set?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    disconnect?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    delete?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    connect?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    update?: RequestAttachmentUpdateWithWhereUniqueWithoutRequestInput | RequestAttachmentUpdateWithWhereUniqueWithoutRequestInput[]
    updateMany?: RequestAttachmentUpdateManyWithWhereWithoutRequestInput | RequestAttachmentUpdateManyWithWhereWithoutRequestInput[]
    deleteMany?: RequestAttachmentScalarWhereInput | RequestAttachmentScalarWhereInput[]
  }

  export type HawbGroupUpdateManyWithoutRequestNestedInput = {
    create?: XOR<HawbGroupCreateWithoutRequestInput, HawbGroupUncheckedCreateWithoutRequestInput> | HawbGroupCreateWithoutRequestInput[] | HawbGroupUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: HawbGroupCreateOrConnectWithoutRequestInput | HawbGroupCreateOrConnectWithoutRequestInput[]
    upsert?: HawbGroupUpsertWithWhereUniqueWithoutRequestInput | HawbGroupUpsertWithWhereUniqueWithoutRequestInput[]
    createMany?: HawbGroupCreateManyRequestInputEnvelope
    set?: HawbGroupWhereUniqueInput | HawbGroupWhereUniqueInput[]
    disconnect?: HawbGroupWhereUniqueInput | HawbGroupWhereUniqueInput[]
    delete?: HawbGroupWhereUniqueInput | HawbGroupWhereUniqueInput[]
    connect?: HawbGroupWhereUniqueInput | HawbGroupWhereUniqueInput[]
    update?: HawbGroupUpdateWithWhereUniqueWithoutRequestInput | HawbGroupUpdateWithWhereUniqueWithoutRequestInput[]
    updateMany?: HawbGroupUpdateManyWithWhereWithoutRequestInput | HawbGroupUpdateManyWithWhereWithoutRequestInput[]
    deleteMany?: HawbGroupScalarWhereInput | HawbGroupScalarWhereInput[]
  }

  export type AirRequestItemUncheckedUpdateManyWithoutRequestNestedInput = {
    create?: XOR<AirRequestItemCreateWithoutRequestInput, AirRequestItemUncheckedCreateWithoutRequestInput> | AirRequestItemCreateWithoutRequestInput[] | AirRequestItemUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: AirRequestItemCreateOrConnectWithoutRequestInput | AirRequestItemCreateOrConnectWithoutRequestInput[]
    upsert?: AirRequestItemUpsertWithWhereUniqueWithoutRequestInput | AirRequestItemUpsertWithWhereUniqueWithoutRequestInput[]
    createMany?: AirRequestItemCreateManyRequestInputEnvelope
    set?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    disconnect?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    delete?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    connect?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    update?: AirRequestItemUpdateWithWhereUniqueWithoutRequestInput | AirRequestItemUpdateWithWhereUniqueWithoutRequestInput[]
    updateMany?: AirRequestItemUpdateManyWithWhereWithoutRequestInput | AirRequestItemUpdateManyWithWhereWithoutRequestInput[]
    deleteMany?: AirRequestItemScalarWhereInput | AirRequestItemScalarWhereInput[]
  }

  export type ApprovalLogUncheckedUpdateManyWithoutRequestNestedInput = {
    create?: XOR<ApprovalLogCreateWithoutRequestInput, ApprovalLogUncheckedCreateWithoutRequestInput> | ApprovalLogCreateWithoutRequestInput[] | ApprovalLogUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: ApprovalLogCreateOrConnectWithoutRequestInput | ApprovalLogCreateOrConnectWithoutRequestInput[]
    upsert?: ApprovalLogUpsertWithWhereUniqueWithoutRequestInput | ApprovalLogUpsertWithWhereUniqueWithoutRequestInput[]
    createMany?: ApprovalLogCreateManyRequestInputEnvelope
    set?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    disconnect?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    delete?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    connect?: ApprovalLogWhereUniqueInput | ApprovalLogWhereUniqueInput[]
    update?: ApprovalLogUpdateWithWhereUniqueWithoutRequestInput | ApprovalLogUpdateWithWhereUniqueWithoutRequestInput[]
    updateMany?: ApprovalLogUpdateManyWithWhereWithoutRequestInput | ApprovalLogUpdateManyWithWhereWithoutRequestInput[]
    deleteMany?: ApprovalLogScalarWhereInput | ApprovalLogScalarWhereInput[]
  }

  export type RequestAttachmentUncheckedUpdateManyWithoutRequestNestedInput = {
    create?: XOR<RequestAttachmentCreateWithoutRequestInput, RequestAttachmentUncheckedCreateWithoutRequestInput> | RequestAttachmentCreateWithoutRequestInput[] | RequestAttachmentUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: RequestAttachmentCreateOrConnectWithoutRequestInput | RequestAttachmentCreateOrConnectWithoutRequestInput[]
    upsert?: RequestAttachmentUpsertWithWhereUniqueWithoutRequestInput | RequestAttachmentUpsertWithWhereUniqueWithoutRequestInput[]
    createMany?: RequestAttachmentCreateManyRequestInputEnvelope
    set?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    disconnect?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    delete?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    connect?: RequestAttachmentWhereUniqueInput | RequestAttachmentWhereUniqueInput[]
    update?: RequestAttachmentUpdateWithWhereUniqueWithoutRequestInput | RequestAttachmentUpdateWithWhereUniqueWithoutRequestInput[]
    updateMany?: RequestAttachmentUpdateManyWithWhereWithoutRequestInput | RequestAttachmentUpdateManyWithWhereWithoutRequestInput[]
    deleteMany?: RequestAttachmentScalarWhereInput | RequestAttachmentScalarWhereInput[]
  }

  export type HawbGroupUncheckedUpdateManyWithoutRequestNestedInput = {
    create?: XOR<HawbGroupCreateWithoutRequestInput, HawbGroupUncheckedCreateWithoutRequestInput> | HawbGroupCreateWithoutRequestInput[] | HawbGroupUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: HawbGroupCreateOrConnectWithoutRequestInput | HawbGroupCreateOrConnectWithoutRequestInput[]
    upsert?: HawbGroupUpsertWithWhereUniqueWithoutRequestInput | HawbGroupUpsertWithWhereUniqueWithoutRequestInput[]
    createMany?: HawbGroupCreateManyRequestInputEnvelope
    set?: HawbGroupWhereUniqueInput | HawbGroupWhereUniqueInput[]
    disconnect?: HawbGroupWhereUniqueInput | HawbGroupWhereUniqueInput[]
    delete?: HawbGroupWhereUniqueInput | HawbGroupWhereUniqueInput[]
    connect?: HawbGroupWhereUniqueInput | HawbGroupWhereUniqueInput[]
    update?: HawbGroupUpdateWithWhereUniqueWithoutRequestInput | HawbGroupUpdateWithWhereUniqueWithoutRequestInput[]
    updateMany?: HawbGroupUpdateManyWithWhereWithoutRequestInput | HawbGroupUpdateManyWithWhereWithoutRequestInput[]
    deleteMany?: HawbGroupScalarWhereInput | HawbGroupScalarWhereInput[]
  }

  export type AirRequestItemCreateNestedOneWithoutClaimApprovalsInput = {
    create?: XOR<AirRequestItemCreateWithoutClaimApprovalsInput, AirRequestItemUncheckedCreateWithoutClaimApprovalsInput>
    connectOrCreate?: AirRequestItemCreateOrConnectWithoutClaimApprovalsInput
    connect?: AirRequestItemWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutClaimApprovalsInput = {
    create?: XOR<UserCreateWithoutClaimApprovalsInput, UserUncheckedCreateWithoutClaimApprovalsInput>
    connectOrCreate?: UserCreateOrConnectWithoutClaimApprovalsInput
    connect?: UserWhereUniqueInput
  }

  export type AirRequestItemUpdateOneRequiredWithoutClaimApprovalsNestedInput = {
    create?: XOR<AirRequestItemCreateWithoutClaimApprovalsInput, AirRequestItemUncheckedCreateWithoutClaimApprovalsInput>
    connectOrCreate?: AirRequestItemCreateOrConnectWithoutClaimApprovalsInput
    upsert?: AirRequestItemUpsertWithoutClaimApprovalsInput
    connect?: AirRequestItemWhereUniqueInput
    update?: XOR<XOR<AirRequestItemUpdateToOneWithWhereWithoutClaimApprovalsInput, AirRequestItemUpdateWithoutClaimApprovalsInput>, AirRequestItemUncheckedUpdateWithoutClaimApprovalsInput>
  }

  export type UserUpdateOneRequiredWithoutClaimApprovalsNestedInput = {
    create?: XOR<UserCreateWithoutClaimApprovalsInput, UserUncheckedCreateWithoutClaimApprovalsInput>
    connectOrCreate?: UserCreateOrConnectWithoutClaimApprovalsInput
    upsert?: UserUpsertWithoutClaimApprovalsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutClaimApprovalsInput, UserUpdateWithoutClaimApprovalsInput>, UserUncheckedUpdateWithoutClaimApprovalsInput>
  }

  export type AirRequestCreateNestedOneWithoutHawbGroupsInput = {
    create?: XOR<AirRequestCreateWithoutHawbGroupsInput, AirRequestUncheckedCreateWithoutHawbGroupsInput>
    connectOrCreate?: AirRequestCreateOrConnectWithoutHawbGroupsInput
    connect?: AirRequestWhereUniqueInput
  }

  export type AirRequestItemCreateNestedManyWithoutHawbGroupInput = {
    create?: XOR<AirRequestItemCreateWithoutHawbGroupInput, AirRequestItemUncheckedCreateWithoutHawbGroupInput> | AirRequestItemCreateWithoutHawbGroupInput[] | AirRequestItemUncheckedCreateWithoutHawbGroupInput[]
    connectOrCreate?: AirRequestItemCreateOrConnectWithoutHawbGroupInput | AirRequestItemCreateOrConnectWithoutHawbGroupInput[]
    createMany?: AirRequestItemCreateManyHawbGroupInputEnvelope
    connect?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
  }

  export type AirRequestItemUncheckedCreateNestedManyWithoutHawbGroupInput = {
    create?: XOR<AirRequestItemCreateWithoutHawbGroupInput, AirRequestItemUncheckedCreateWithoutHawbGroupInput> | AirRequestItemCreateWithoutHawbGroupInput[] | AirRequestItemUncheckedCreateWithoutHawbGroupInput[]
    connectOrCreate?: AirRequestItemCreateOrConnectWithoutHawbGroupInput | AirRequestItemCreateOrConnectWithoutHawbGroupInput[]
    createMany?: AirRequestItemCreateManyHawbGroupInputEnvelope
    connect?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
  }

  export type AirRequestUpdateOneRequiredWithoutHawbGroupsNestedInput = {
    create?: XOR<AirRequestCreateWithoutHawbGroupsInput, AirRequestUncheckedCreateWithoutHawbGroupsInput>
    connectOrCreate?: AirRequestCreateOrConnectWithoutHawbGroupsInput
    upsert?: AirRequestUpsertWithoutHawbGroupsInput
    connect?: AirRequestWhereUniqueInput
    update?: XOR<XOR<AirRequestUpdateToOneWithWhereWithoutHawbGroupsInput, AirRequestUpdateWithoutHawbGroupsInput>, AirRequestUncheckedUpdateWithoutHawbGroupsInput>
  }

  export type AirRequestItemUpdateManyWithoutHawbGroupNestedInput = {
    create?: XOR<AirRequestItemCreateWithoutHawbGroupInput, AirRequestItemUncheckedCreateWithoutHawbGroupInput> | AirRequestItemCreateWithoutHawbGroupInput[] | AirRequestItemUncheckedCreateWithoutHawbGroupInput[]
    connectOrCreate?: AirRequestItemCreateOrConnectWithoutHawbGroupInput | AirRequestItemCreateOrConnectWithoutHawbGroupInput[]
    upsert?: AirRequestItemUpsertWithWhereUniqueWithoutHawbGroupInput | AirRequestItemUpsertWithWhereUniqueWithoutHawbGroupInput[]
    createMany?: AirRequestItemCreateManyHawbGroupInputEnvelope
    set?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    disconnect?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    delete?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    connect?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    update?: AirRequestItemUpdateWithWhereUniqueWithoutHawbGroupInput | AirRequestItemUpdateWithWhereUniqueWithoutHawbGroupInput[]
    updateMany?: AirRequestItemUpdateManyWithWhereWithoutHawbGroupInput | AirRequestItemUpdateManyWithWhereWithoutHawbGroupInput[]
    deleteMany?: AirRequestItemScalarWhereInput | AirRequestItemScalarWhereInput[]
  }

  export type AirRequestItemUncheckedUpdateManyWithoutHawbGroupNestedInput = {
    create?: XOR<AirRequestItemCreateWithoutHawbGroupInput, AirRequestItemUncheckedCreateWithoutHawbGroupInput> | AirRequestItemCreateWithoutHawbGroupInput[] | AirRequestItemUncheckedCreateWithoutHawbGroupInput[]
    connectOrCreate?: AirRequestItemCreateOrConnectWithoutHawbGroupInput | AirRequestItemCreateOrConnectWithoutHawbGroupInput[]
    upsert?: AirRequestItemUpsertWithWhereUniqueWithoutHawbGroupInput | AirRequestItemUpsertWithWhereUniqueWithoutHawbGroupInput[]
    createMany?: AirRequestItemCreateManyHawbGroupInputEnvelope
    set?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    disconnect?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    delete?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    connect?: AirRequestItemWhereUniqueInput | AirRequestItemWhereUniqueInput[]
    update?: AirRequestItemUpdateWithWhereUniqueWithoutHawbGroupInput | AirRequestItemUpdateWithWhereUniqueWithoutHawbGroupInput[]
    updateMany?: AirRequestItemUpdateManyWithWhereWithoutHawbGroupInput | AirRequestItemUpdateManyWithWhereWithoutHawbGroupInput[]
    deleteMany?: AirRequestItemScalarWhereInput | AirRequestItemScalarWhereInput[]
  }

  export type AirRequestCreateNestedOneWithoutItemsInput = {
    create?: XOR<AirRequestCreateWithoutItemsInput, AirRequestUncheckedCreateWithoutItemsInput>
    connectOrCreate?: AirRequestCreateOrConnectWithoutItemsInput
    connect?: AirRequestWhereUniqueInput
  }

  export type HawbGroupCreateNestedOneWithoutItemsInput = {
    create?: XOR<HawbGroupCreateWithoutItemsInput, HawbGroupUncheckedCreateWithoutItemsInput>
    connectOrCreate?: HawbGroupCreateOrConnectWithoutItemsInput
    connect?: HawbGroupWhereUniqueInput
  }

  export type ClaimApprovalCreateNestedManyWithoutItemInput = {
    create?: XOR<ClaimApprovalCreateWithoutItemInput, ClaimApprovalUncheckedCreateWithoutItemInput> | ClaimApprovalCreateWithoutItemInput[] | ClaimApprovalUncheckedCreateWithoutItemInput[]
    connectOrCreate?: ClaimApprovalCreateOrConnectWithoutItemInput | ClaimApprovalCreateOrConnectWithoutItemInput[]
    createMany?: ClaimApprovalCreateManyItemInputEnvelope
    connect?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
  }

  export type ClaimApprovalUncheckedCreateNestedManyWithoutItemInput = {
    create?: XOR<ClaimApprovalCreateWithoutItemInput, ClaimApprovalUncheckedCreateWithoutItemInput> | ClaimApprovalCreateWithoutItemInput[] | ClaimApprovalUncheckedCreateWithoutItemInput[]
    connectOrCreate?: ClaimApprovalCreateOrConnectWithoutItemInput | ClaimApprovalCreateOrConnectWithoutItemInput[]
    createMany?: ClaimApprovalCreateManyItemInputEnvelope
    connect?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type AirRequestUpdateOneRequiredWithoutItemsNestedInput = {
    create?: XOR<AirRequestCreateWithoutItemsInput, AirRequestUncheckedCreateWithoutItemsInput>
    connectOrCreate?: AirRequestCreateOrConnectWithoutItemsInput
    upsert?: AirRequestUpsertWithoutItemsInput
    connect?: AirRequestWhereUniqueInput
    update?: XOR<XOR<AirRequestUpdateToOneWithWhereWithoutItemsInput, AirRequestUpdateWithoutItemsInput>, AirRequestUncheckedUpdateWithoutItemsInput>
  }

  export type HawbGroupUpdateOneWithoutItemsNestedInput = {
    create?: XOR<HawbGroupCreateWithoutItemsInput, HawbGroupUncheckedCreateWithoutItemsInput>
    connectOrCreate?: HawbGroupCreateOrConnectWithoutItemsInput
    upsert?: HawbGroupUpsertWithoutItemsInput
    disconnect?: HawbGroupWhereInput | boolean
    delete?: HawbGroupWhereInput | boolean
    connect?: HawbGroupWhereUniqueInput
    update?: XOR<XOR<HawbGroupUpdateToOneWithWhereWithoutItemsInput, HawbGroupUpdateWithoutItemsInput>, HawbGroupUncheckedUpdateWithoutItemsInput>
  }

  export type ClaimApprovalUpdateManyWithoutItemNestedInput = {
    create?: XOR<ClaimApprovalCreateWithoutItemInput, ClaimApprovalUncheckedCreateWithoutItemInput> | ClaimApprovalCreateWithoutItemInput[] | ClaimApprovalUncheckedCreateWithoutItemInput[]
    connectOrCreate?: ClaimApprovalCreateOrConnectWithoutItemInput | ClaimApprovalCreateOrConnectWithoutItemInput[]
    upsert?: ClaimApprovalUpsertWithWhereUniqueWithoutItemInput | ClaimApprovalUpsertWithWhereUniqueWithoutItemInput[]
    createMany?: ClaimApprovalCreateManyItemInputEnvelope
    set?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    disconnect?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    delete?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    connect?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    update?: ClaimApprovalUpdateWithWhereUniqueWithoutItemInput | ClaimApprovalUpdateWithWhereUniqueWithoutItemInput[]
    updateMany?: ClaimApprovalUpdateManyWithWhereWithoutItemInput | ClaimApprovalUpdateManyWithWhereWithoutItemInput[]
    deleteMany?: ClaimApprovalScalarWhereInput | ClaimApprovalScalarWhereInput[]
  }

  export type ClaimApprovalUncheckedUpdateManyWithoutItemNestedInput = {
    create?: XOR<ClaimApprovalCreateWithoutItemInput, ClaimApprovalUncheckedCreateWithoutItemInput> | ClaimApprovalCreateWithoutItemInput[] | ClaimApprovalUncheckedCreateWithoutItemInput[]
    connectOrCreate?: ClaimApprovalCreateOrConnectWithoutItemInput | ClaimApprovalCreateOrConnectWithoutItemInput[]
    upsert?: ClaimApprovalUpsertWithWhereUniqueWithoutItemInput | ClaimApprovalUpsertWithWhereUniqueWithoutItemInput[]
    createMany?: ClaimApprovalCreateManyItemInputEnvelope
    set?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    disconnect?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    delete?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    connect?: ClaimApprovalWhereUniqueInput | ClaimApprovalWhereUniqueInput[]
    update?: ClaimApprovalUpdateWithWhereUniqueWithoutItemInput | ClaimApprovalUpdateWithWhereUniqueWithoutItemInput[]
    updateMany?: ClaimApprovalUpdateManyWithWhereWithoutItemInput | ClaimApprovalUpdateManyWithWhereWithoutItemInput[]
    deleteMany?: ClaimApprovalScalarWhereInput | ClaimApprovalScalarWhereInput[]
  }

  export type AirRequestCreateNestedOneWithoutApprovalLogsInput = {
    create?: XOR<AirRequestCreateWithoutApprovalLogsInput, AirRequestUncheckedCreateWithoutApprovalLogsInput>
    connectOrCreate?: AirRequestCreateOrConnectWithoutApprovalLogsInput
    connect?: AirRequestWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutApprovalsInput = {
    create?: XOR<UserCreateWithoutApprovalsInput, UserUncheckedCreateWithoutApprovalsInput>
    connectOrCreate?: UserCreateOrConnectWithoutApprovalsInput
    connect?: UserWhereUniqueInput
  }

  export type AirRequestUpdateOneRequiredWithoutApprovalLogsNestedInput = {
    create?: XOR<AirRequestCreateWithoutApprovalLogsInput, AirRequestUncheckedCreateWithoutApprovalLogsInput>
    connectOrCreate?: AirRequestCreateOrConnectWithoutApprovalLogsInput
    upsert?: AirRequestUpsertWithoutApprovalLogsInput
    connect?: AirRequestWhereUniqueInput
    update?: XOR<XOR<AirRequestUpdateToOneWithWhereWithoutApprovalLogsInput, AirRequestUpdateWithoutApprovalLogsInput>, AirRequestUncheckedUpdateWithoutApprovalLogsInput>
  }

  export type UserUpdateOneRequiredWithoutApprovalsNestedInput = {
    create?: XOR<UserCreateWithoutApprovalsInput, UserUncheckedCreateWithoutApprovalsInput>
    connectOrCreate?: UserCreateOrConnectWithoutApprovalsInput
    upsert?: UserUpsertWithoutApprovalsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutApprovalsInput, UserUpdateWithoutApprovalsInput>, UserUncheckedUpdateWithoutApprovalsInput>
  }

  export type AirRequestCreateNestedOneWithoutAttachmentsInput = {
    create?: XOR<AirRequestCreateWithoutAttachmentsInput, AirRequestUncheckedCreateWithoutAttachmentsInput>
    connectOrCreate?: AirRequestCreateOrConnectWithoutAttachmentsInput
    connect?: AirRequestWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutAttachmentsInput = {
    create?: XOR<UserCreateWithoutAttachmentsInput, UserUncheckedCreateWithoutAttachmentsInput>
    connectOrCreate?: UserCreateOrConnectWithoutAttachmentsInput
    connect?: UserWhereUniqueInput
  }

  export type AirRequestUpdateOneRequiredWithoutAttachmentsNestedInput = {
    create?: XOR<AirRequestCreateWithoutAttachmentsInput, AirRequestUncheckedCreateWithoutAttachmentsInput>
    connectOrCreate?: AirRequestCreateOrConnectWithoutAttachmentsInput
    upsert?: AirRequestUpsertWithoutAttachmentsInput
    connect?: AirRequestWhereUniqueInput
    update?: XOR<XOR<AirRequestUpdateToOneWithWhereWithoutAttachmentsInput, AirRequestUpdateWithoutAttachmentsInput>, AirRequestUncheckedUpdateWithoutAttachmentsInput>
  }

  export type UserUpdateOneRequiredWithoutAttachmentsNestedInput = {
    create?: XOR<UserCreateWithoutAttachmentsInput, UserUncheckedCreateWithoutAttachmentsInput>
    connectOrCreate?: UserCreateOrConnectWithoutAttachmentsInput
    upsert?: UserUpsertWithoutAttachmentsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutAttachmentsInput, UserUpdateWithoutAttachmentsInput>, UserUncheckedUpdateWithoutAttachmentsInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type NestedFloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type AirRequestCreateWithoutCreatedByInput = {
    id?: string
    documentNo: string
    brandName: string
    buName: string
    status?: string
    claimDepartment?: string | null
    rejectionReason?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    invoiceNo?: string | null
    actualAirFreight?: number | null
    bookingDate?: Date | string | null
    airline?: string | null
    assignedVpMer?: string | null
    vpMerToken?: string | null
    presidentToken?: string | null
    scmToken?: string | null
    vpScmToken?: string | null
    assignedVpScm?: string | null
    logisticsToken?: string | null
    accountingToken?: string | null
    claimNextEmail?: string | null
    claimNextToken?: string | null
    claimNextName?: string | null
    bu?: string
    items?: AirRequestItemCreateNestedManyWithoutRequestInput
    approvalLogs?: ApprovalLogCreateNestedManyWithoutRequestInput
    attachments?: RequestAttachmentCreateNestedManyWithoutRequestInput
    hawbGroups?: HawbGroupCreateNestedManyWithoutRequestInput
  }

  export type AirRequestUncheckedCreateWithoutCreatedByInput = {
    id?: string
    documentNo: string
    brandName: string
    buName: string
    status?: string
    claimDepartment?: string | null
    rejectionReason?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    invoiceNo?: string | null
    actualAirFreight?: number | null
    bookingDate?: Date | string | null
    airline?: string | null
    assignedVpMer?: string | null
    vpMerToken?: string | null
    presidentToken?: string | null
    scmToken?: string | null
    vpScmToken?: string | null
    assignedVpScm?: string | null
    logisticsToken?: string | null
    accountingToken?: string | null
    claimNextEmail?: string | null
    claimNextToken?: string | null
    claimNextName?: string | null
    bu?: string
    items?: AirRequestItemUncheckedCreateNestedManyWithoutRequestInput
    approvalLogs?: ApprovalLogUncheckedCreateNestedManyWithoutRequestInput
    attachments?: RequestAttachmentUncheckedCreateNestedManyWithoutRequestInput
    hawbGroups?: HawbGroupUncheckedCreateNestedManyWithoutRequestInput
  }

  export type AirRequestCreateOrConnectWithoutCreatedByInput = {
    where: AirRequestWhereUniqueInput
    create: XOR<AirRequestCreateWithoutCreatedByInput, AirRequestUncheckedCreateWithoutCreatedByInput>
  }

  export type AirRequestCreateManyCreatedByInputEnvelope = {
    data: AirRequestCreateManyCreatedByInput | AirRequestCreateManyCreatedByInput[]
    skipDuplicates?: boolean
  }

  export type ApprovalLogCreateWithoutUserInput = {
    id?: string
    action: string
    fromStatus: string
    toStatus: string
    comment?: string | null
    createdAt?: Date | string
    request: AirRequestCreateNestedOneWithoutApprovalLogsInput
  }

  export type ApprovalLogUncheckedCreateWithoutUserInput = {
    id?: string
    requestId: string
    action: string
    fromStatus: string
    toStatus: string
    comment?: string | null
    createdAt?: Date | string
  }

  export type ApprovalLogCreateOrConnectWithoutUserInput = {
    where: ApprovalLogWhereUniqueInput
    create: XOR<ApprovalLogCreateWithoutUserInput, ApprovalLogUncheckedCreateWithoutUserInput>
  }

  export type ApprovalLogCreateManyUserInputEnvelope = {
    data: ApprovalLogCreateManyUserInput | ApprovalLogCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type ClaimApprovalCreateWithoutUserInput = {
    id?: string
    role: string
    createdAt?: Date | string
    item: AirRequestItemCreateNestedOneWithoutClaimApprovalsInput
  }

  export type ClaimApprovalUncheckedCreateWithoutUserInput = {
    id?: string
    itemId: string
    role: string
    createdAt?: Date | string
  }

  export type ClaimApprovalCreateOrConnectWithoutUserInput = {
    where: ClaimApprovalWhereUniqueInput
    create: XOR<ClaimApprovalCreateWithoutUserInput, ClaimApprovalUncheckedCreateWithoutUserInput>
  }

  export type ClaimApprovalCreateManyUserInputEnvelope = {
    data: ClaimApprovalCreateManyUserInput | ClaimApprovalCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type RequestAttachmentCreateWithoutUploadedByInput = {
    id?: string
    itemId?: string | null
    fileName: string
    filePath: string
    fileSize: number
    mimeType: string
    claimDept?: string | null
    createdAt?: Date | string
    request: AirRequestCreateNestedOneWithoutAttachmentsInput
  }

  export type RequestAttachmentUncheckedCreateWithoutUploadedByInput = {
    id?: string
    requestId: string
    itemId?: string | null
    fileName: string
    filePath: string
    fileSize: number
    mimeType: string
    claimDept?: string | null
    createdAt?: Date | string
  }

  export type RequestAttachmentCreateOrConnectWithoutUploadedByInput = {
    where: RequestAttachmentWhereUniqueInput
    create: XOR<RequestAttachmentCreateWithoutUploadedByInput, RequestAttachmentUncheckedCreateWithoutUploadedByInput>
  }

  export type RequestAttachmentCreateManyUploadedByInputEnvelope = {
    data: RequestAttachmentCreateManyUploadedByInput | RequestAttachmentCreateManyUploadedByInput[]
    skipDuplicates?: boolean
  }

  export type AirRequestUpsertWithWhereUniqueWithoutCreatedByInput = {
    where: AirRequestWhereUniqueInput
    update: XOR<AirRequestUpdateWithoutCreatedByInput, AirRequestUncheckedUpdateWithoutCreatedByInput>
    create: XOR<AirRequestCreateWithoutCreatedByInput, AirRequestUncheckedCreateWithoutCreatedByInput>
  }

  export type AirRequestUpdateWithWhereUniqueWithoutCreatedByInput = {
    where: AirRequestWhereUniqueInput
    data: XOR<AirRequestUpdateWithoutCreatedByInput, AirRequestUncheckedUpdateWithoutCreatedByInput>
  }

  export type AirRequestUpdateManyWithWhereWithoutCreatedByInput = {
    where: AirRequestScalarWhereInput
    data: XOR<AirRequestUpdateManyMutationInput, AirRequestUncheckedUpdateManyWithoutCreatedByInput>
  }

  export type AirRequestScalarWhereInput = {
    AND?: AirRequestScalarWhereInput | AirRequestScalarWhereInput[]
    OR?: AirRequestScalarWhereInput[]
    NOT?: AirRequestScalarWhereInput | AirRequestScalarWhereInput[]
    id?: StringFilter<"AirRequest"> | string
    documentNo?: StringFilter<"AirRequest"> | string
    brandName?: StringFilter<"AirRequest"> | string
    buName?: StringFilter<"AirRequest"> | string
    status?: StringFilter<"AirRequest"> | string
    claimDepartment?: StringNullableFilter<"AirRequest"> | string | null
    rejectionReason?: StringNullableFilter<"AirRequest"> | string | null
    createdById?: StringFilter<"AirRequest"> | string
    createdAt?: DateTimeFilter<"AirRequest"> | Date | string
    updatedAt?: DateTimeFilter<"AirRequest"> | Date | string
    invoiceNo?: StringNullableFilter<"AirRequest"> | string | null
    actualAirFreight?: FloatNullableFilter<"AirRequest"> | number | null
    bookingDate?: DateTimeNullableFilter<"AirRequest"> | Date | string | null
    airline?: StringNullableFilter<"AirRequest"> | string | null
    assignedVpMer?: StringNullableFilter<"AirRequest"> | string | null
    vpMerToken?: StringNullableFilter<"AirRequest"> | string | null
    presidentToken?: StringNullableFilter<"AirRequest"> | string | null
    scmToken?: StringNullableFilter<"AirRequest"> | string | null
    vpScmToken?: StringNullableFilter<"AirRequest"> | string | null
    assignedVpScm?: StringNullableFilter<"AirRequest"> | string | null
    logisticsToken?: StringNullableFilter<"AirRequest"> | string | null
    accountingToken?: StringNullableFilter<"AirRequest"> | string | null
    claimNextEmail?: StringNullableFilter<"AirRequest"> | string | null
    claimNextToken?: StringNullableFilter<"AirRequest"> | string | null
    claimNextName?: StringNullableFilter<"AirRequest"> | string | null
    bu?: StringFilter<"AirRequest"> | string
  }

  export type ApprovalLogUpsertWithWhereUniqueWithoutUserInput = {
    where: ApprovalLogWhereUniqueInput
    update: XOR<ApprovalLogUpdateWithoutUserInput, ApprovalLogUncheckedUpdateWithoutUserInput>
    create: XOR<ApprovalLogCreateWithoutUserInput, ApprovalLogUncheckedCreateWithoutUserInput>
  }

  export type ApprovalLogUpdateWithWhereUniqueWithoutUserInput = {
    where: ApprovalLogWhereUniqueInput
    data: XOR<ApprovalLogUpdateWithoutUserInput, ApprovalLogUncheckedUpdateWithoutUserInput>
  }

  export type ApprovalLogUpdateManyWithWhereWithoutUserInput = {
    where: ApprovalLogScalarWhereInput
    data: XOR<ApprovalLogUpdateManyMutationInput, ApprovalLogUncheckedUpdateManyWithoutUserInput>
  }

  export type ApprovalLogScalarWhereInput = {
    AND?: ApprovalLogScalarWhereInput | ApprovalLogScalarWhereInput[]
    OR?: ApprovalLogScalarWhereInput[]
    NOT?: ApprovalLogScalarWhereInput | ApprovalLogScalarWhereInput[]
    id?: StringFilter<"ApprovalLog"> | string
    requestId?: StringFilter<"ApprovalLog"> | string
    userId?: StringFilter<"ApprovalLog"> | string
    action?: StringFilter<"ApprovalLog"> | string
    fromStatus?: StringFilter<"ApprovalLog"> | string
    toStatus?: StringFilter<"ApprovalLog"> | string
    comment?: StringNullableFilter<"ApprovalLog"> | string | null
    createdAt?: DateTimeFilter<"ApprovalLog"> | Date | string
  }

  export type ClaimApprovalUpsertWithWhereUniqueWithoutUserInput = {
    where: ClaimApprovalWhereUniqueInput
    update: XOR<ClaimApprovalUpdateWithoutUserInput, ClaimApprovalUncheckedUpdateWithoutUserInput>
    create: XOR<ClaimApprovalCreateWithoutUserInput, ClaimApprovalUncheckedCreateWithoutUserInput>
  }

  export type ClaimApprovalUpdateWithWhereUniqueWithoutUserInput = {
    where: ClaimApprovalWhereUniqueInput
    data: XOR<ClaimApprovalUpdateWithoutUserInput, ClaimApprovalUncheckedUpdateWithoutUserInput>
  }

  export type ClaimApprovalUpdateManyWithWhereWithoutUserInput = {
    where: ClaimApprovalScalarWhereInput
    data: XOR<ClaimApprovalUpdateManyMutationInput, ClaimApprovalUncheckedUpdateManyWithoutUserInput>
  }

  export type ClaimApprovalScalarWhereInput = {
    AND?: ClaimApprovalScalarWhereInput | ClaimApprovalScalarWhereInput[]
    OR?: ClaimApprovalScalarWhereInput[]
    NOT?: ClaimApprovalScalarWhereInput | ClaimApprovalScalarWhereInput[]
    id?: StringFilter<"ClaimApproval"> | string
    itemId?: StringFilter<"ClaimApproval"> | string
    userId?: StringFilter<"ClaimApproval"> | string
    role?: StringFilter<"ClaimApproval"> | string
    createdAt?: DateTimeFilter<"ClaimApproval"> | Date | string
  }

  export type RequestAttachmentUpsertWithWhereUniqueWithoutUploadedByInput = {
    where: RequestAttachmentWhereUniqueInput
    update: XOR<RequestAttachmentUpdateWithoutUploadedByInput, RequestAttachmentUncheckedUpdateWithoutUploadedByInput>
    create: XOR<RequestAttachmentCreateWithoutUploadedByInput, RequestAttachmentUncheckedCreateWithoutUploadedByInput>
  }

  export type RequestAttachmentUpdateWithWhereUniqueWithoutUploadedByInput = {
    where: RequestAttachmentWhereUniqueInput
    data: XOR<RequestAttachmentUpdateWithoutUploadedByInput, RequestAttachmentUncheckedUpdateWithoutUploadedByInput>
  }

  export type RequestAttachmentUpdateManyWithWhereWithoutUploadedByInput = {
    where: RequestAttachmentScalarWhereInput
    data: XOR<RequestAttachmentUpdateManyMutationInput, RequestAttachmentUncheckedUpdateManyWithoutUploadedByInput>
  }

  export type RequestAttachmentScalarWhereInput = {
    AND?: RequestAttachmentScalarWhereInput | RequestAttachmentScalarWhereInput[]
    OR?: RequestAttachmentScalarWhereInput[]
    NOT?: RequestAttachmentScalarWhereInput | RequestAttachmentScalarWhereInput[]
    id?: StringFilter<"RequestAttachment"> | string
    requestId?: StringFilter<"RequestAttachment"> | string
    itemId?: StringNullableFilter<"RequestAttachment"> | string | null
    uploadedById?: StringFilter<"RequestAttachment"> | string
    fileName?: StringFilter<"RequestAttachment"> | string
    filePath?: StringFilter<"RequestAttachment"> | string
    fileSize?: IntFilter<"RequestAttachment"> | number
    mimeType?: StringFilter<"RequestAttachment"> | string
    claimDept?: StringNullableFilter<"RequestAttachment"> | string | null
    createdAt?: DateTimeFilter<"RequestAttachment"> | Date | string
  }

  export type UserCreateWithoutAirRequestsInput = {
    id?: string
    name?: string | null
    email: string
    password?: string | null
    role?: string
    claimDepartment?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    priority?: number | null
    bu?: string
    procurementType?: string | null
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    approvals?: ApprovalLogCreateNestedManyWithoutUserInput
    claimApprovals?: ClaimApprovalCreateNestedManyWithoutUserInput
    attachments?: RequestAttachmentCreateNestedManyWithoutUploadedByInput
  }

  export type UserUncheckedCreateWithoutAirRequestsInput = {
    id?: string
    name?: string | null
    email: string
    password?: string | null
    role?: string
    claimDepartment?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    priority?: number | null
    bu?: string
    procurementType?: string | null
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    approvals?: ApprovalLogUncheckedCreateNestedManyWithoutUserInput
    claimApprovals?: ClaimApprovalUncheckedCreateNestedManyWithoutUserInput
    attachments?: RequestAttachmentUncheckedCreateNestedManyWithoutUploadedByInput
  }

  export type UserCreateOrConnectWithoutAirRequestsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutAirRequestsInput, UserUncheckedCreateWithoutAirRequestsInput>
  }

  export type AirRequestItemCreateWithoutRequestInput = {
    id?: string
    style: string
    so: string
    sub?: string | null
    customerPO?: string | null
    description?: string | null
    gmtType?: string | null
    originalShipmentDate?: Date | string | null
    planShipmentDate?: Date | string | null
    qtyOriginalShipment: number
    qtyRequestAir: number
    itemStatus?: string
    itemComment?: string | null
    reasonDelay: string
    factory: string
    country: string
    port: string
    grossWeight?: number | null
    airFreight?: number | null
    marketRatePerKg?: number | null
    actualAirFreight?: number | null
    claimDepartment?: string | null
    invoiceNo?: string | null
    hawbNo?: string | null
    bookingDate?: Date | string | null
    assignedDvm?: string | null
    claimPercentage?: number | null
    qtyActualShip?: number | null
    hawbGroup?: HawbGroupCreateNestedOneWithoutItemsInput
    claimApprovals?: ClaimApprovalCreateNestedManyWithoutItemInput
  }

  export type AirRequestItemUncheckedCreateWithoutRequestInput = {
    id?: string
    hawbGroupId?: string | null
    style: string
    so: string
    sub?: string | null
    customerPO?: string | null
    description?: string | null
    gmtType?: string | null
    originalShipmentDate?: Date | string | null
    planShipmentDate?: Date | string | null
    qtyOriginalShipment: number
    qtyRequestAir: number
    itemStatus?: string
    itemComment?: string | null
    reasonDelay: string
    factory: string
    country: string
    port: string
    grossWeight?: number | null
    airFreight?: number | null
    marketRatePerKg?: number | null
    actualAirFreight?: number | null
    claimDepartment?: string | null
    invoiceNo?: string | null
    hawbNo?: string | null
    bookingDate?: Date | string | null
    assignedDvm?: string | null
    claimPercentage?: number | null
    qtyActualShip?: number | null
    claimApprovals?: ClaimApprovalUncheckedCreateNestedManyWithoutItemInput
  }

  export type AirRequestItemCreateOrConnectWithoutRequestInput = {
    where: AirRequestItemWhereUniqueInput
    create: XOR<AirRequestItemCreateWithoutRequestInput, AirRequestItemUncheckedCreateWithoutRequestInput>
  }

  export type AirRequestItemCreateManyRequestInputEnvelope = {
    data: AirRequestItemCreateManyRequestInput | AirRequestItemCreateManyRequestInput[]
    skipDuplicates?: boolean
  }

  export type ApprovalLogCreateWithoutRequestInput = {
    id?: string
    action: string
    fromStatus: string
    toStatus: string
    comment?: string | null
    createdAt?: Date | string
    user: UserCreateNestedOneWithoutApprovalsInput
  }

  export type ApprovalLogUncheckedCreateWithoutRequestInput = {
    id?: string
    userId: string
    action: string
    fromStatus: string
    toStatus: string
    comment?: string | null
    createdAt?: Date | string
  }

  export type ApprovalLogCreateOrConnectWithoutRequestInput = {
    where: ApprovalLogWhereUniqueInput
    create: XOR<ApprovalLogCreateWithoutRequestInput, ApprovalLogUncheckedCreateWithoutRequestInput>
  }

  export type ApprovalLogCreateManyRequestInputEnvelope = {
    data: ApprovalLogCreateManyRequestInput | ApprovalLogCreateManyRequestInput[]
    skipDuplicates?: boolean
  }

  export type RequestAttachmentCreateWithoutRequestInput = {
    id?: string
    itemId?: string | null
    fileName: string
    filePath: string
    fileSize: number
    mimeType: string
    claimDept?: string | null
    createdAt?: Date | string
    uploadedBy: UserCreateNestedOneWithoutAttachmentsInput
  }

  export type RequestAttachmentUncheckedCreateWithoutRequestInput = {
    id?: string
    itemId?: string | null
    uploadedById: string
    fileName: string
    filePath: string
    fileSize: number
    mimeType: string
    claimDept?: string | null
    createdAt?: Date | string
  }

  export type RequestAttachmentCreateOrConnectWithoutRequestInput = {
    where: RequestAttachmentWhereUniqueInput
    create: XOR<RequestAttachmentCreateWithoutRequestInput, RequestAttachmentUncheckedCreateWithoutRequestInput>
  }

  export type RequestAttachmentCreateManyRequestInputEnvelope = {
    data: RequestAttachmentCreateManyRequestInput | RequestAttachmentCreateManyRequestInput[]
    skipDuplicates?: boolean
  }

  export type HawbGroupCreateWithoutRequestInput = {
    id?: string
    hawbNo: string
    totalCharge: number
    createdAt?: Date | string
    items?: AirRequestItemCreateNestedManyWithoutHawbGroupInput
  }

  export type HawbGroupUncheckedCreateWithoutRequestInput = {
    id?: string
    hawbNo: string
    totalCharge: number
    createdAt?: Date | string
    items?: AirRequestItemUncheckedCreateNestedManyWithoutHawbGroupInput
  }

  export type HawbGroupCreateOrConnectWithoutRequestInput = {
    where: HawbGroupWhereUniqueInput
    create: XOR<HawbGroupCreateWithoutRequestInput, HawbGroupUncheckedCreateWithoutRequestInput>
  }

  export type HawbGroupCreateManyRequestInputEnvelope = {
    data: HawbGroupCreateManyRequestInput | HawbGroupCreateManyRequestInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithoutAirRequestsInput = {
    update: XOR<UserUpdateWithoutAirRequestsInput, UserUncheckedUpdateWithoutAirRequestsInput>
    create: XOR<UserCreateWithoutAirRequestsInput, UserUncheckedCreateWithoutAirRequestsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutAirRequestsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutAirRequestsInput, UserUncheckedUpdateWithoutAirRequestsInput>
  }

  export type UserUpdateWithoutAirRequestsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    priority?: NullableIntFieldUpdateOperationsInput | number | null
    bu?: StringFieldUpdateOperationsInput | string
    procurementType?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    approvals?: ApprovalLogUpdateManyWithoutUserNestedInput
    claimApprovals?: ClaimApprovalUpdateManyWithoutUserNestedInput
    attachments?: RequestAttachmentUpdateManyWithoutUploadedByNestedInput
  }

  export type UserUncheckedUpdateWithoutAirRequestsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    priority?: NullableIntFieldUpdateOperationsInput | number | null
    bu?: StringFieldUpdateOperationsInput | string
    procurementType?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    approvals?: ApprovalLogUncheckedUpdateManyWithoutUserNestedInput
    claimApprovals?: ClaimApprovalUncheckedUpdateManyWithoutUserNestedInput
    attachments?: RequestAttachmentUncheckedUpdateManyWithoutUploadedByNestedInput
  }

  export type AirRequestItemUpsertWithWhereUniqueWithoutRequestInput = {
    where: AirRequestItemWhereUniqueInput
    update: XOR<AirRequestItemUpdateWithoutRequestInput, AirRequestItemUncheckedUpdateWithoutRequestInput>
    create: XOR<AirRequestItemCreateWithoutRequestInput, AirRequestItemUncheckedCreateWithoutRequestInput>
  }

  export type AirRequestItemUpdateWithWhereUniqueWithoutRequestInput = {
    where: AirRequestItemWhereUniqueInput
    data: XOR<AirRequestItemUpdateWithoutRequestInput, AirRequestItemUncheckedUpdateWithoutRequestInput>
  }

  export type AirRequestItemUpdateManyWithWhereWithoutRequestInput = {
    where: AirRequestItemScalarWhereInput
    data: XOR<AirRequestItemUpdateManyMutationInput, AirRequestItemUncheckedUpdateManyWithoutRequestInput>
  }

  export type AirRequestItemScalarWhereInput = {
    AND?: AirRequestItemScalarWhereInput | AirRequestItemScalarWhereInput[]
    OR?: AirRequestItemScalarWhereInput[]
    NOT?: AirRequestItemScalarWhereInput | AirRequestItemScalarWhereInput[]
    id?: StringFilter<"AirRequestItem"> | string
    requestId?: StringFilter<"AirRequestItem"> | string
    hawbGroupId?: StringNullableFilter<"AirRequestItem"> | string | null
    style?: StringFilter<"AirRequestItem"> | string
    so?: StringFilter<"AirRequestItem"> | string
    sub?: StringNullableFilter<"AirRequestItem"> | string | null
    customerPO?: StringNullableFilter<"AirRequestItem"> | string | null
    description?: StringNullableFilter<"AirRequestItem"> | string | null
    gmtType?: StringNullableFilter<"AirRequestItem"> | string | null
    originalShipmentDate?: DateTimeNullableFilter<"AirRequestItem"> | Date | string | null
    planShipmentDate?: DateTimeNullableFilter<"AirRequestItem"> | Date | string | null
    qtyOriginalShipment?: IntFilter<"AirRequestItem"> | number
    qtyRequestAir?: IntFilter<"AirRequestItem"> | number
    itemStatus?: StringFilter<"AirRequestItem"> | string
    itemComment?: StringNullableFilter<"AirRequestItem"> | string | null
    reasonDelay?: StringFilter<"AirRequestItem"> | string
    factory?: StringFilter<"AirRequestItem"> | string
    country?: StringFilter<"AirRequestItem"> | string
    port?: StringFilter<"AirRequestItem"> | string
    grossWeight?: FloatNullableFilter<"AirRequestItem"> | number | null
    airFreight?: FloatNullableFilter<"AirRequestItem"> | number | null
    marketRatePerKg?: FloatNullableFilter<"AirRequestItem"> | number | null
    actualAirFreight?: FloatNullableFilter<"AirRequestItem"> | number | null
    claimDepartment?: StringNullableFilter<"AirRequestItem"> | string | null
    invoiceNo?: StringNullableFilter<"AirRequestItem"> | string | null
    hawbNo?: StringNullableFilter<"AirRequestItem"> | string | null
    bookingDate?: DateTimeNullableFilter<"AirRequestItem"> | Date | string | null
    assignedDvm?: StringNullableFilter<"AirRequestItem"> | string | null
    claimPercentage?: FloatNullableFilter<"AirRequestItem"> | number | null
    qtyActualShip?: IntNullableFilter<"AirRequestItem"> | number | null
  }

  export type ApprovalLogUpsertWithWhereUniqueWithoutRequestInput = {
    where: ApprovalLogWhereUniqueInput
    update: XOR<ApprovalLogUpdateWithoutRequestInput, ApprovalLogUncheckedUpdateWithoutRequestInput>
    create: XOR<ApprovalLogCreateWithoutRequestInput, ApprovalLogUncheckedCreateWithoutRequestInput>
  }

  export type ApprovalLogUpdateWithWhereUniqueWithoutRequestInput = {
    where: ApprovalLogWhereUniqueInput
    data: XOR<ApprovalLogUpdateWithoutRequestInput, ApprovalLogUncheckedUpdateWithoutRequestInput>
  }

  export type ApprovalLogUpdateManyWithWhereWithoutRequestInput = {
    where: ApprovalLogScalarWhereInput
    data: XOR<ApprovalLogUpdateManyMutationInput, ApprovalLogUncheckedUpdateManyWithoutRequestInput>
  }

  export type RequestAttachmentUpsertWithWhereUniqueWithoutRequestInput = {
    where: RequestAttachmentWhereUniqueInput
    update: XOR<RequestAttachmentUpdateWithoutRequestInput, RequestAttachmentUncheckedUpdateWithoutRequestInput>
    create: XOR<RequestAttachmentCreateWithoutRequestInput, RequestAttachmentUncheckedCreateWithoutRequestInput>
  }

  export type RequestAttachmentUpdateWithWhereUniqueWithoutRequestInput = {
    where: RequestAttachmentWhereUniqueInput
    data: XOR<RequestAttachmentUpdateWithoutRequestInput, RequestAttachmentUncheckedUpdateWithoutRequestInput>
  }

  export type RequestAttachmentUpdateManyWithWhereWithoutRequestInput = {
    where: RequestAttachmentScalarWhereInput
    data: XOR<RequestAttachmentUpdateManyMutationInput, RequestAttachmentUncheckedUpdateManyWithoutRequestInput>
  }

  export type HawbGroupUpsertWithWhereUniqueWithoutRequestInput = {
    where: HawbGroupWhereUniqueInput
    update: XOR<HawbGroupUpdateWithoutRequestInput, HawbGroupUncheckedUpdateWithoutRequestInput>
    create: XOR<HawbGroupCreateWithoutRequestInput, HawbGroupUncheckedCreateWithoutRequestInput>
  }

  export type HawbGroupUpdateWithWhereUniqueWithoutRequestInput = {
    where: HawbGroupWhereUniqueInput
    data: XOR<HawbGroupUpdateWithoutRequestInput, HawbGroupUncheckedUpdateWithoutRequestInput>
  }

  export type HawbGroupUpdateManyWithWhereWithoutRequestInput = {
    where: HawbGroupScalarWhereInput
    data: XOR<HawbGroupUpdateManyMutationInput, HawbGroupUncheckedUpdateManyWithoutRequestInput>
  }

  export type HawbGroupScalarWhereInput = {
    AND?: HawbGroupScalarWhereInput | HawbGroupScalarWhereInput[]
    OR?: HawbGroupScalarWhereInput[]
    NOT?: HawbGroupScalarWhereInput | HawbGroupScalarWhereInput[]
    id?: StringFilter<"HawbGroup"> | string
    requestId?: StringFilter<"HawbGroup"> | string
    hawbNo?: StringFilter<"HawbGroup"> | string
    totalCharge?: FloatFilter<"HawbGroup"> | number
    createdAt?: DateTimeFilter<"HawbGroup"> | Date | string
  }

  export type AirRequestItemCreateWithoutClaimApprovalsInput = {
    id?: string
    style: string
    so: string
    sub?: string | null
    customerPO?: string | null
    description?: string | null
    gmtType?: string | null
    originalShipmentDate?: Date | string | null
    planShipmentDate?: Date | string | null
    qtyOriginalShipment: number
    qtyRequestAir: number
    itemStatus?: string
    itemComment?: string | null
    reasonDelay: string
    factory: string
    country: string
    port: string
    grossWeight?: number | null
    airFreight?: number | null
    marketRatePerKg?: number | null
    actualAirFreight?: number | null
    claimDepartment?: string | null
    invoiceNo?: string | null
    hawbNo?: string | null
    bookingDate?: Date | string | null
    assignedDvm?: string | null
    claimPercentage?: number | null
    qtyActualShip?: number | null
    request: AirRequestCreateNestedOneWithoutItemsInput
    hawbGroup?: HawbGroupCreateNestedOneWithoutItemsInput
  }

  export type AirRequestItemUncheckedCreateWithoutClaimApprovalsInput = {
    id?: string
    requestId: string
    hawbGroupId?: string | null
    style: string
    so: string
    sub?: string | null
    customerPO?: string | null
    description?: string | null
    gmtType?: string | null
    originalShipmentDate?: Date | string | null
    planShipmentDate?: Date | string | null
    qtyOriginalShipment: number
    qtyRequestAir: number
    itemStatus?: string
    itemComment?: string | null
    reasonDelay: string
    factory: string
    country: string
    port: string
    grossWeight?: number | null
    airFreight?: number | null
    marketRatePerKg?: number | null
    actualAirFreight?: number | null
    claimDepartment?: string | null
    invoiceNo?: string | null
    hawbNo?: string | null
    bookingDate?: Date | string | null
    assignedDvm?: string | null
    claimPercentage?: number | null
    qtyActualShip?: number | null
  }

  export type AirRequestItemCreateOrConnectWithoutClaimApprovalsInput = {
    where: AirRequestItemWhereUniqueInput
    create: XOR<AirRequestItemCreateWithoutClaimApprovalsInput, AirRequestItemUncheckedCreateWithoutClaimApprovalsInput>
  }

  export type UserCreateWithoutClaimApprovalsInput = {
    id?: string
    name?: string | null
    email: string
    password?: string | null
    role?: string
    claimDepartment?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    priority?: number | null
    bu?: string
    procurementType?: string | null
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    airRequests?: AirRequestCreateNestedManyWithoutCreatedByInput
    approvals?: ApprovalLogCreateNestedManyWithoutUserInput
    attachments?: RequestAttachmentCreateNestedManyWithoutUploadedByInput
  }

  export type UserUncheckedCreateWithoutClaimApprovalsInput = {
    id?: string
    name?: string | null
    email: string
    password?: string | null
    role?: string
    claimDepartment?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    priority?: number | null
    bu?: string
    procurementType?: string | null
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    airRequests?: AirRequestUncheckedCreateNestedManyWithoutCreatedByInput
    approvals?: ApprovalLogUncheckedCreateNestedManyWithoutUserInput
    attachments?: RequestAttachmentUncheckedCreateNestedManyWithoutUploadedByInput
  }

  export type UserCreateOrConnectWithoutClaimApprovalsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutClaimApprovalsInput, UserUncheckedCreateWithoutClaimApprovalsInput>
  }

  export type AirRequestItemUpsertWithoutClaimApprovalsInput = {
    update: XOR<AirRequestItemUpdateWithoutClaimApprovalsInput, AirRequestItemUncheckedUpdateWithoutClaimApprovalsInput>
    create: XOR<AirRequestItemCreateWithoutClaimApprovalsInput, AirRequestItemUncheckedCreateWithoutClaimApprovalsInput>
    where?: AirRequestItemWhereInput
  }

  export type AirRequestItemUpdateToOneWithWhereWithoutClaimApprovalsInput = {
    where?: AirRequestItemWhereInput
    data: XOR<AirRequestItemUpdateWithoutClaimApprovalsInput, AirRequestItemUncheckedUpdateWithoutClaimApprovalsInput>
  }

  export type AirRequestItemUpdateWithoutClaimApprovalsInput = {
    id?: StringFieldUpdateOperationsInput | string
    style?: StringFieldUpdateOperationsInput | string
    so?: StringFieldUpdateOperationsInput | string
    sub?: NullableStringFieldUpdateOperationsInput | string | null
    customerPO?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    gmtType?: NullableStringFieldUpdateOperationsInput | string | null
    originalShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    qtyOriginalShipment?: IntFieldUpdateOperationsInput | number
    qtyRequestAir?: IntFieldUpdateOperationsInput | number
    itemStatus?: StringFieldUpdateOperationsInput | string
    itemComment?: NullableStringFieldUpdateOperationsInput | string | null
    reasonDelay?: StringFieldUpdateOperationsInput | string
    factory?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    grossWeight?: NullableFloatFieldUpdateOperationsInput | number | null
    airFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    marketRatePerKg?: NullableFloatFieldUpdateOperationsInput | number | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    hawbNo?: NullableStringFieldUpdateOperationsInput | string | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedDvm?: NullableStringFieldUpdateOperationsInput | string | null
    claimPercentage?: NullableFloatFieldUpdateOperationsInput | number | null
    qtyActualShip?: NullableIntFieldUpdateOperationsInput | number | null
    request?: AirRequestUpdateOneRequiredWithoutItemsNestedInput
    hawbGroup?: HawbGroupUpdateOneWithoutItemsNestedInput
  }

  export type AirRequestItemUncheckedUpdateWithoutClaimApprovalsInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    hawbGroupId?: NullableStringFieldUpdateOperationsInput | string | null
    style?: StringFieldUpdateOperationsInput | string
    so?: StringFieldUpdateOperationsInput | string
    sub?: NullableStringFieldUpdateOperationsInput | string | null
    customerPO?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    gmtType?: NullableStringFieldUpdateOperationsInput | string | null
    originalShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    qtyOriginalShipment?: IntFieldUpdateOperationsInput | number
    qtyRequestAir?: IntFieldUpdateOperationsInput | number
    itemStatus?: StringFieldUpdateOperationsInput | string
    itemComment?: NullableStringFieldUpdateOperationsInput | string | null
    reasonDelay?: StringFieldUpdateOperationsInput | string
    factory?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    grossWeight?: NullableFloatFieldUpdateOperationsInput | number | null
    airFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    marketRatePerKg?: NullableFloatFieldUpdateOperationsInput | number | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    hawbNo?: NullableStringFieldUpdateOperationsInput | string | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedDvm?: NullableStringFieldUpdateOperationsInput | string | null
    claimPercentage?: NullableFloatFieldUpdateOperationsInput | number | null
    qtyActualShip?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type UserUpsertWithoutClaimApprovalsInput = {
    update: XOR<UserUpdateWithoutClaimApprovalsInput, UserUncheckedUpdateWithoutClaimApprovalsInput>
    create: XOR<UserCreateWithoutClaimApprovalsInput, UserUncheckedCreateWithoutClaimApprovalsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutClaimApprovalsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutClaimApprovalsInput, UserUncheckedUpdateWithoutClaimApprovalsInput>
  }

  export type UserUpdateWithoutClaimApprovalsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    priority?: NullableIntFieldUpdateOperationsInput | number | null
    bu?: StringFieldUpdateOperationsInput | string
    procurementType?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airRequests?: AirRequestUpdateManyWithoutCreatedByNestedInput
    approvals?: ApprovalLogUpdateManyWithoutUserNestedInput
    attachments?: RequestAttachmentUpdateManyWithoutUploadedByNestedInput
  }

  export type UserUncheckedUpdateWithoutClaimApprovalsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    priority?: NullableIntFieldUpdateOperationsInput | number | null
    bu?: StringFieldUpdateOperationsInput | string
    procurementType?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airRequests?: AirRequestUncheckedUpdateManyWithoutCreatedByNestedInput
    approvals?: ApprovalLogUncheckedUpdateManyWithoutUserNestedInput
    attachments?: RequestAttachmentUncheckedUpdateManyWithoutUploadedByNestedInput
  }

  export type AirRequestCreateWithoutHawbGroupsInput = {
    id?: string
    documentNo: string
    brandName: string
    buName: string
    status?: string
    claimDepartment?: string | null
    rejectionReason?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    invoiceNo?: string | null
    actualAirFreight?: number | null
    bookingDate?: Date | string | null
    airline?: string | null
    assignedVpMer?: string | null
    vpMerToken?: string | null
    presidentToken?: string | null
    scmToken?: string | null
    vpScmToken?: string | null
    assignedVpScm?: string | null
    logisticsToken?: string | null
    accountingToken?: string | null
    claimNextEmail?: string | null
    claimNextToken?: string | null
    claimNextName?: string | null
    bu?: string
    createdBy: UserCreateNestedOneWithoutAirRequestsInput
    items?: AirRequestItemCreateNestedManyWithoutRequestInput
    approvalLogs?: ApprovalLogCreateNestedManyWithoutRequestInput
    attachments?: RequestAttachmentCreateNestedManyWithoutRequestInput
  }

  export type AirRequestUncheckedCreateWithoutHawbGroupsInput = {
    id?: string
    documentNo: string
    brandName: string
    buName: string
    status?: string
    claimDepartment?: string | null
    rejectionReason?: string | null
    createdById: string
    createdAt?: Date | string
    updatedAt?: Date | string
    invoiceNo?: string | null
    actualAirFreight?: number | null
    bookingDate?: Date | string | null
    airline?: string | null
    assignedVpMer?: string | null
    vpMerToken?: string | null
    presidentToken?: string | null
    scmToken?: string | null
    vpScmToken?: string | null
    assignedVpScm?: string | null
    logisticsToken?: string | null
    accountingToken?: string | null
    claimNextEmail?: string | null
    claimNextToken?: string | null
    claimNextName?: string | null
    bu?: string
    items?: AirRequestItemUncheckedCreateNestedManyWithoutRequestInput
    approvalLogs?: ApprovalLogUncheckedCreateNestedManyWithoutRequestInput
    attachments?: RequestAttachmentUncheckedCreateNestedManyWithoutRequestInput
  }

  export type AirRequestCreateOrConnectWithoutHawbGroupsInput = {
    where: AirRequestWhereUniqueInput
    create: XOR<AirRequestCreateWithoutHawbGroupsInput, AirRequestUncheckedCreateWithoutHawbGroupsInput>
  }

  export type AirRequestItemCreateWithoutHawbGroupInput = {
    id?: string
    style: string
    so: string
    sub?: string | null
    customerPO?: string | null
    description?: string | null
    gmtType?: string | null
    originalShipmentDate?: Date | string | null
    planShipmentDate?: Date | string | null
    qtyOriginalShipment: number
    qtyRequestAir: number
    itemStatus?: string
    itemComment?: string | null
    reasonDelay: string
    factory: string
    country: string
    port: string
    grossWeight?: number | null
    airFreight?: number | null
    marketRatePerKg?: number | null
    actualAirFreight?: number | null
    claimDepartment?: string | null
    invoiceNo?: string | null
    hawbNo?: string | null
    bookingDate?: Date | string | null
    assignedDvm?: string | null
    claimPercentage?: number | null
    qtyActualShip?: number | null
    request: AirRequestCreateNestedOneWithoutItemsInput
    claimApprovals?: ClaimApprovalCreateNestedManyWithoutItemInput
  }

  export type AirRequestItemUncheckedCreateWithoutHawbGroupInput = {
    id?: string
    requestId: string
    style: string
    so: string
    sub?: string | null
    customerPO?: string | null
    description?: string | null
    gmtType?: string | null
    originalShipmentDate?: Date | string | null
    planShipmentDate?: Date | string | null
    qtyOriginalShipment: number
    qtyRequestAir: number
    itemStatus?: string
    itemComment?: string | null
    reasonDelay: string
    factory: string
    country: string
    port: string
    grossWeight?: number | null
    airFreight?: number | null
    marketRatePerKg?: number | null
    actualAirFreight?: number | null
    claimDepartment?: string | null
    invoiceNo?: string | null
    hawbNo?: string | null
    bookingDate?: Date | string | null
    assignedDvm?: string | null
    claimPercentage?: number | null
    qtyActualShip?: number | null
    claimApprovals?: ClaimApprovalUncheckedCreateNestedManyWithoutItemInput
  }

  export type AirRequestItemCreateOrConnectWithoutHawbGroupInput = {
    where: AirRequestItemWhereUniqueInput
    create: XOR<AirRequestItemCreateWithoutHawbGroupInput, AirRequestItemUncheckedCreateWithoutHawbGroupInput>
  }

  export type AirRequestItemCreateManyHawbGroupInputEnvelope = {
    data: AirRequestItemCreateManyHawbGroupInput | AirRequestItemCreateManyHawbGroupInput[]
    skipDuplicates?: boolean
  }

  export type AirRequestUpsertWithoutHawbGroupsInput = {
    update: XOR<AirRequestUpdateWithoutHawbGroupsInput, AirRequestUncheckedUpdateWithoutHawbGroupsInput>
    create: XOR<AirRequestCreateWithoutHawbGroupsInput, AirRequestUncheckedCreateWithoutHawbGroupsInput>
    where?: AirRequestWhereInput
  }

  export type AirRequestUpdateToOneWithWhereWithoutHawbGroupsInput = {
    where?: AirRequestWhereInput
    data: XOR<AirRequestUpdateWithoutHawbGroupsInput, AirRequestUncheckedUpdateWithoutHawbGroupsInput>
  }

  export type AirRequestUpdateWithoutHawbGroupsInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
    createdBy?: UserUpdateOneRequiredWithoutAirRequestsNestedInput
    items?: AirRequestItemUpdateManyWithoutRequestNestedInput
    approvalLogs?: ApprovalLogUpdateManyWithoutRequestNestedInput
    attachments?: RequestAttachmentUpdateManyWithoutRequestNestedInput
  }

  export type AirRequestUncheckedUpdateWithoutHawbGroupsInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
    items?: AirRequestItemUncheckedUpdateManyWithoutRequestNestedInput
    approvalLogs?: ApprovalLogUncheckedUpdateManyWithoutRequestNestedInput
    attachments?: RequestAttachmentUncheckedUpdateManyWithoutRequestNestedInput
  }

  export type AirRequestItemUpsertWithWhereUniqueWithoutHawbGroupInput = {
    where: AirRequestItemWhereUniqueInput
    update: XOR<AirRequestItemUpdateWithoutHawbGroupInput, AirRequestItemUncheckedUpdateWithoutHawbGroupInput>
    create: XOR<AirRequestItemCreateWithoutHawbGroupInput, AirRequestItemUncheckedCreateWithoutHawbGroupInput>
  }

  export type AirRequestItemUpdateWithWhereUniqueWithoutHawbGroupInput = {
    where: AirRequestItemWhereUniqueInput
    data: XOR<AirRequestItemUpdateWithoutHawbGroupInput, AirRequestItemUncheckedUpdateWithoutHawbGroupInput>
  }

  export type AirRequestItemUpdateManyWithWhereWithoutHawbGroupInput = {
    where: AirRequestItemScalarWhereInput
    data: XOR<AirRequestItemUpdateManyMutationInput, AirRequestItemUncheckedUpdateManyWithoutHawbGroupInput>
  }

  export type AirRequestCreateWithoutItemsInput = {
    id?: string
    documentNo: string
    brandName: string
    buName: string
    status?: string
    claimDepartment?: string | null
    rejectionReason?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    invoiceNo?: string | null
    actualAirFreight?: number | null
    bookingDate?: Date | string | null
    airline?: string | null
    assignedVpMer?: string | null
    vpMerToken?: string | null
    presidentToken?: string | null
    scmToken?: string | null
    vpScmToken?: string | null
    assignedVpScm?: string | null
    logisticsToken?: string | null
    accountingToken?: string | null
    claimNextEmail?: string | null
    claimNextToken?: string | null
    claimNextName?: string | null
    bu?: string
    createdBy: UserCreateNestedOneWithoutAirRequestsInput
    approvalLogs?: ApprovalLogCreateNestedManyWithoutRequestInput
    attachments?: RequestAttachmentCreateNestedManyWithoutRequestInput
    hawbGroups?: HawbGroupCreateNestedManyWithoutRequestInput
  }

  export type AirRequestUncheckedCreateWithoutItemsInput = {
    id?: string
    documentNo: string
    brandName: string
    buName: string
    status?: string
    claimDepartment?: string | null
    rejectionReason?: string | null
    createdById: string
    createdAt?: Date | string
    updatedAt?: Date | string
    invoiceNo?: string | null
    actualAirFreight?: number | null
    bookingDate?: Date | string | null
    airline?: string | null
    assignedVpMer?: string | null
    vpMerToken?: string | null
    presidentToken?: string | null
    scmToken?: string | null
    vpScmToken?: string | null
    assignedVpScm?: string | null
    logisticsToken?: string | null
    accountingToken?: string | null
    claimNextEmail?: string | null
    claimNextToken?: string | null
    claimNextName?: string | null
    bu?: string
    approvalLogs?: ApprovalLogUncheckedCreateNestedManyWithoutRequestInput
    attachments?: RequestAttachmentUncheckedCreateNestedManyWithoutRequestInput
    hawbGroups?: HawbGroupUncheckedCreateNestedManyWithoutRequestInput
  }

  export type AirRequestCreateOrConnectWithoutItemsInput = {
    where: AirRequestWhereUniqueInput
    create: XOR<AirRequestCreateWithoutItemsInput, AirRequestUncheckedCreateWithoutItemsInput>
  }

  export type HawbGroupCreateWithoutItemsInput = {
    id?: string
    hawbNo: string
    totalCharge: number
    createdAt?: Date | string
    request: AirRequestCreateNestedOneWithoutHawbGroupsInput
  }

  export type HawbGroupUncheckedCreateWithoutItemsInput = {
    id?: string
    requestId: string
    hawbNo: string
    totalCharge: number
    createdAt?: Date | string
  }

  export type HawbGroupCreateOrConnectWithoutItemsInput = {
    where: HawbGroupWhereUniqueInput
    create: XOR<HawbGroupCreateWithoutItemsInput, HawbGroupUncheckedCreateWithoutItemsInput>
  }

  export type ClaimApprovalCreateWithoutItemInput = {
    id?: string
    role: string
    createdAt?: Date | string
    user: UserCreateNestedOneWithoutClaimApprovalsInput
  }

  export type ClaimApprovalUncheckedCreateWithoutItemInput = {
    id?: string
    userId: string
    role: string
    createdAt?: Date | string
  }

  export type ClaimApprovalCreateOrConnectWithoutItemInput = {
    where: ClaimApprovalWhereUniqueInput
    create: XOR<ClaimApprovalCreateWithoutItemInput, ClaimApprovalUncheckedCreateWithoutItemInput>
  }

  export type ClaimApprovalCreateManyItemInputEnvelope = {
    data: ClaimApprovalCreateManyItemInput | ClaimApprovalCreateManyItemInput[]
    skipDuplicates?: boolean
  }

  export type AirRequestUpsertWithoutItemsInput = {
    update: XOR<AirRequestUpdateWithoutItemsInput, AirRequestUncheckedUpdateWithoutItemsInput>
    create: XOR<AirRequestCreateWithoutItemsInput, AirRequestUncheckedCreateWithoutItemsInput>
    where?: AirRequestWhereInput
  }

  export type AirRequestUpdateToOneWithWhereWithoutItemsInput = {
    where?: AirRequestWhereInput
    data: XOR<AirRequestUpdateWithoutItemsInput, AirRequestUncheckedUpdateWithoutItemsInput>
  }

  export type AirRequestUpdateWithoutItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
    createdBy?: UserUpdateOneRequiredWithoutAirRequestsNestedInput
    approvalLogs?: ApprovalLogUpdateManyWithoutRequestNestedInput
    attachments?: RequestAttachmentUpdateManyWithoutRequestNestedInput
    hawbGroups?: HawbGroupUpdateManyWithoutRequestNestedInput
  }

  export type AirRequestUncheckedUpdateWithoutItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
    approvalLogs?: ApprovalLogUncheckedUpdateManyWithoutRequestNestedInput
    attachments?: RequestAttachmentUncheckedUpdateManyWithoutRequestNestedInput
    hawbGroups?: HawbGroupUncheckedUpdateManyWithoutRequestNestedInput
  }

  export type HawbGroupUpsertWithoutItemsInput = {
    update: XOR<HawbGroupUpdateWithoutItemsInput, HawbGroupUncheckedUpdateWithoutItemsInput>
    create: XOR<HawbGroupCreateWithoutItemsInput, HawbGroupUncheckedCreateWithoutItemsInput>
    where?: HawbGroupWhereInput
  }

  export type HawbGroupUpdateToOneWithWhereWithoutItemsInput = {
    where?: HawbGroupWhereInput
    data: XOR<HawbGroupUpdateWithoutItemsInput, HawbGroupUncheckedUpdateWithoutItemsInput>
  }

  export type HawbGroupUpdateWithoutItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    hawbNo?: StringFieldUpdateOperationsInput | string
    totalCharge?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    request?: AirRequestUpdateOneRequiredWithoutHawbGroupsNestedInput
  }

  export type HawbGroupUncheckedUpdateWithoutItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    hawbNo?: StringFieldUpdateOperationsInput | string
    totalCharge?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClaimApprovalUpsertWithWhereUniqueWithoutItemInput = {
    where: ClaimApprovalWhereUniqueInput
    update: XOR<ClaimApprovalUpdateWithoutItemInput, ClaimApprovalUncheckedUpdateWithoutItemInput>
    create: XOR<ClaimApprovalCreateWithoutItemInput, ClaimApprovalUncheckedCreateWithoutItemInput>
  }

  export type ClaimApprovalUpdateWithWhereUniqueWithoutItemInput = {
    where: ClaimApprovalWhereUniqueInput
    data: XOR<ClaimApprovalUpdateWithoutItemInput, ClaimApprovalUncheckedUpdateWithoutItemInput>
  }

  export type ClaimApprovalUpdateManyWithWhereWithoutItemInput = {
    where: ClaimApprovalScalarWhereInput
    data: XOR<ClaimApprovalUpdateManyMutationInput, ClaimApprovalUncheckedUpdateManyWithoutItemInput>
  }

  export type AirRequestCreateWithoutApprovalLogsInput = {
    id?: string
    documentNo: string
    brandName: string
    buName: string
    status?: string
    claimDepartment?: string | null
    rejectionReason?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    invoiceNo?: string | null
    actualAirFreight?: number | null
    bookingDate?: Date | string | null
    airline?: string | null
    assignedVpMer?: string | null
    vpMerToken?: string | null
    presidentToken?: string | null
    scmToken?: string | null
    vpScmToken?: string | null
    assignedVpScm?: string | null
    logisticsToken?: string | null
    accountingToken?: string | null
    claimNextEmail?: string | null
    claimNextToken?: string | null
    claimNextName?: string | null
    bu?: string
    createdBy: UserCreateNestedOneWithoutAirRequestsInput
    items?: AirRequestItemCreateNestedManyWithoutRequestInput
    attachments?: RequestAttachmentCreateNestedManyWithoutRequestInput
    hawbGroups?: HawbGroupCreateNestedManyWithoutRequestInput
  }

  export type AirRequestUncheckedCreateWithoutApprovalLogsInput = {
    id?: string
    documentNo: string
    brandName: string
    buName: string
    status?: string
    claimDepartment?: string | null
    rejectionReason?: string | null
    createdById: string
    createdAt?: Date | string
    updatedAt?: Date | string
    invoiceNo?: string | null
    actualAirFreight?: number | null
    bookingDate?: Date | string | null
    airline?: string | null
    assignedVpMer?: string | null
    vpMerToken?: string | null
    presidentToken?: string | null
    scmToken?: string | null
    vpScmToken?: string | null
    assignedVpScm?: string | null
    logisticsToken?: string | null
    accountingToken?: string | null
    claimNextEmail?: string | null
    claimNextToken?: string | null
    claimNextName?: string | null
    bu?: string
    items?: AirRequestItemUncheckedCreateNestedManyWithoutRequestInput
    attachments?: RequestAttachmentUncheckedCreateNestedManyWithoutRequestInput
    hawbGroups?: HawbGroupUncheckedCreateNestedManyWithoutRequestInput
  }

  export type AirRequestCreateOrConnectWithoutApprovalLogsInput = {
    where: AirRequestWhereUniqueInput
    create: XOR<AirRequestCreateWithoutApprovalLogsInput, AirRequestUncheckedCreateWithoutApprovalLogsInput>
  }

  export type UserCreateWithoutApprovalsInput = {
    id?: string
    name?: string | null
    email: string
    password?: string | null
    role?: string
    claimDepartment?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    priority?: number | null
    bu?: string
    procurementType?: string | null
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    airRequests?: AirRequestCreateNestedManyWithoutCreatedByInput
    claimApprovals?: ClaimApprovalCreateNestedManyWithoutUserInput
    attachments?: RequestAttachmentCreateNestedManyWithoutUploadedByInput
  }

  export type UserUncheckedCreateWithoutApprovalsInput = {
    id?: string
    name?: string | null
    email: string
    password?: string | null
    role?: string
    claimDepartment?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    priority?: number | null
    bu?: string
    procurementType?: string | null
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    airRequests?: AirRequestUncheckedCreateNestedManyWithoutCreatedByInput
    claimApprovals?: ClaimApprovalUncheckedCreateNestedManyWithoutUserInput
    attachments?: RequestAttachmentUncheckedCreateNestedManyWithoutUploadedByInput
  }

  export type UserCreateOrConnectWithoutApprovalsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutApprovalsInput, UserUncheckedCreateWithoutApprovalsInput>
  }

  export type AirRequestUpsertWithoutApprovalLogsInput = {
    update: XOR<AirRequestUpdateWithoutApprovalLogsInput, AirRequestUncheckedUpdateWithoutApprovalLogsInput>
    create: XOR<AirRequestCreateWithoutApprovalLogsInput, AirRequestUncheckedCreateWithoutApprovalLogsInput>
    where?: AirRequestWhereInput
  }

  export type AirRequestUpdateToOneWithWhereWithoutApprovalLogsInput = {
    where?: AirRequestWhereInput
    data: XOR<AirRequestUpdateWithoutApprovalLogsInput, AirRequestUncheckedUpdateWithoutApprovalLogsInput>
  }

  export type AirRequestUpdateWithoutApprovalLogsInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
    createdBy?: UserUpdateOneRequiredWithoutAirRequestsNestedInput
    items?: AirRequestItemUpdateManyWithoutRequestNestedInput
    attachments?: RequestAttachmentUpdateManyWithoutRequestNestedInput
    hawbGroups?: HawbGroupUpdateManyWithoutRequestNestedInput
  }

  export type AirRequestUncheckedUpdateWithoutApprovalLogsInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
    items?: AirRequestItemUncheckedUpdateManyWithoutRequestNestedInput
    attachments?: RequestAttachmentUncheckedUpdateManyWithoutRequestNestedInput
    hawbGroups?: HawbGroupUncheckedUpdateManyWithoutRequestNestedInput
  }

  export type UserUpsertWithoutApprovalsInput = {
    update: XOR<UserUpdateWithoutApprovalsInput, UserUncheckedUpdateWithoutApprovalsInput>
    create: XOR<UserCreateWithoutApprovalsInput, UserUncheckedCreateWithoutApprovalsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutApprovalsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutApprovalsInput, UserUncheckedUpdateWithoutApprovalsInput>
  }

  export type UserUpdateWithoutApprovalsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    priority?: NullableIntFieldUpdateOperationsInput | number | null
    bu?: StringFieldUpdateOperationsInput | string
    procurementType?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airRequests?: AirRequestUpdateManyWithoutCreatedByNestedInput
    claimApprovals?: ClaimApprovalUpdateManyWithoutUserNestedInput
    attachments?: RequestAttachmentUpdateManyWithoutUploadedByNestedInput
  }

  export type UserUncheckedUpdateWithoutApprovalsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    priority?: NullableIntFieldUpdateOperationsInput | number | null
    bu?: StringFieldUpdateOperationsInput | string
    procurementType?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airRequests?: AirRequestUncheckedUpdateManyWithoutCreatedByNestedInput
    claimApprovals?: ClaimApprovalUncheckedUpdateManyWithoutUserNestedInput
    attachments?: RequestAttachmentUncheckedUpdateManyWithoutUploadedByNestedInput
  }

  export type AirRequestCreateWithoutAttachmentsInput = {
    id?: string
    documentNo: string
    brandName: string
    buName: string
    status?: string
    claimDepartment?: string | null
    rejectionReason?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    invoiceNo?: string | null
    actualAirFreight?: number | null
    bookingDate?: Date | string | null
    airline?: string | null
    assignedVpMer?: string | null
    vpMerToken?: string | null
    presidentToken?: string | null
    scmToken?: string | null
    vpScmToken?: string | null
    assignedVpScm?: string | null
    logisticsToken?: string | null
    accountingToken?: string | null
    claimNextEmail?: string | null
    claimNextToken?: string | null
    claimNextName?: string | null
    bu?: string
    createdBy: UserCreateNestedOneWithoutAirRequestsInput
    items?: AirRequestItemCreateNestedManyWithoutRequestInput
    approvalLogs?: ApprovalLogCreateNestedManyWithoutRequestInput
    hawbGroups?: HawbGroupCreateNestedManyWithoutRequestInput
  }

  export type AirRequestUncheckedCreateWithoutAttachmentsInput = {
    id?: string
    documentNo: string
    brandName: string
    buName: string
    status?: string
    claimDepartment?: string | null
    rejectionReason?: string | null
    createdById: string
    createdAt?: Date | string
    updatedAt?: Date | string
    invoiceNo?: string | null
    actualAirFreight?: number | null
    bookingDate?: Date | string | null
    airline?: string | null
    assignedVpMer?: string | null
    vpMerToken?: string | null
    presidentToken?: string | null
    scmToken?: string | null
    vpScmToken?: string | null
    assignedVpScm?: string | null
    logisticsToken?: string | null
    accountingToken?: string | null
    claimNextEmail?: string | null
    claimNextToken?: string | null
    claimNextName?: string | null
    bu?: string
    items?: AirRequestItemUncheckedCreateNestedManyWithoutRequestInput
    approvalLogs?: ApprovalLogUncheckedCreateNestedManyWithoutRequestInput
    hawbGroups?: HawbGroupUncheckedCreateNestedManyWithoutRequestInput
  }

  export type AirRequestCreateOrConnectWithoutAttachmentsInput = {
    where: AirRequestWhereUniqueInput
    create: XOR<AirRequestCreateWithoutAttachmentsInput, AirRequestUncheckedCreateWithoutAttachmentsInput>
  }

  export type UserCreateWithoutAttachmentsInput = {
    id?: string
    name?: string | null
    email: string
    password?: string | null
    role?: string
    claimDepartment?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    priority?: number | null
    bu?: string
    procurementType?: string | null
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    airRequests?: AirRequestCreateNestedManyWithoutCreatedByInput
    approvals?: ApprovalLogCreateNestedManyWithoutUserInput
    claimApprovals?: ClaimApprovalCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutAttachmentsInput = {
    id?: string
    name?: string | null
    email: string
    password?: string | null
    role?: string
    claimDepartment?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    priority?: number | null
    bu?: string
    procurementType?: string | null
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    airRequests?: AirRequestUncheckedCreateNestedManyWithoutCreatedByInput
    approvals?: ApprovalLogUncheckedCreateNestedManyWithoutUserInput
    claimApprovals?: ClaimApprovalUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutAttachmentsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutAttachmentsInput, UserUncheckedCreateWithoutAttachmentsInput>
  }

  export type AirRequestUpsertWithoutAttachmentsInput = {
    update: XOR<AirRequestUpdateWithoutAttachmentsInput, AirRequestUncheckedUpdateWithoutAttachmentsInput>
    create: XOR<AirRequestCreateWithoutAttachmentsInput, AirRequestUncheckedCreateWithoutAttachmentsInput>
    where?: AirRequestWhereInput
  }

  export type AirRequestUpdateToOneWithWhereWithoutAttachmentsInput = {
    where?: AirRequestWhereInput
    data: XOR<AirRequestUpdateWithoutAttachmentsInput, AirRequestUncheckedUpdateWithoutAttachmentsInput>
  }

  export type AirRequestUpdateWithoutAttachmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
    createdBy?: UserUpdateOneRequiredWithoutAirRequestsNestedInput
    items?: AirRequestItemUpdateManyWithoutRequestNestedInput
    approvalLogs?: ApprovalLogUpdateManyWithoutRequestNestedInput
    hawbGroups?: HawbGroupUpdateManyWithoutRequestNestedInput
  }

  export type AirRequestUncheckedUpdateWithoutAttachmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
    items?: AirRequestItemUncheckedUpdateManyWithoutRequestNestedInput
    approvalLogs?: ApprovalLogUncheckedUpdateManyWithoutRequestNestedInput
    hawbGroups?: HawbGroupUncheckedUpdateManyWithoutRequestNestedInput
  }

  export type UserUpsertWithoutAttachmentsInput = {
    update: XOR<UserUpdateWithoutAttachmentsInput, UserUncheckedUpdateWithoutAttachmentsInput>
    create: XOR<UserCreateWithoutAttachmentsInput, UserUncheckedCreateWithoutAttachmentsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutAttachmentsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutAttachmentsInput, UserUncheckedUpdateWithoutAttachmentsInput>
  }

  export type UserUpdateWithoutAttachmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    priority?: NullableIntFieldUpdateOperationsInput | number | null
    bu?: StringFieldUpdateOperationsInput | string
    procurementType?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airRequests?: AirRequestUpdateManyWithoutCreatedByNestedInput
    approvals?: ApprovalLogUpdateManyWithoutUserNestedInput
    claimApprovals?: ClaimApprovalUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutAttachmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: NullableStringFieldUpdateOperationsInput | string | null
    role?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    priority?: NullableIntFieldUpdateOperationsInput | number | null
    bu?: StringFieldUpdateOperationsInput | string
    procurementType?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airRequests?: AirRequestUncheckedUpdateManyWithoutCreatedByNestedInput
    approvals?: ApprovalLogUncheckedUpdateManyWithoutUserNestedInput
    claimApprovals?: ClaimApprovalUncheckedUpdateManyWithoutUserNestedInput
  }

  export type AirRequestCreateManyCreatedByInput = {
    id?: string
    documentNo: string
    brandName: string
    buName: string
    status?: string
    claimDepartment?: string | null
    rejectionReason?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    invoiceNo?: string | null
    actualAirFreight?: number | null
    bookingDate?: Date | string | null
    airline?: string | null
    assignedVpMer?: string | null
    vpMerToken?: string | null
    presidentToken?: string | null
    scmToken?: string | null
    vpScmToken?: string | null
    assignedVpScm?: string | null
    logisticsToken?: string | null
    accountingToken?: string | null
    claimNextEmail?: string | null
    claimNextToken?: string | null
    claimNextName?: string | null
    bu?: string
  }

  export type ApprovalLogCreateManyUserInput = {
    id?: string
    requestId: string
    action: string
    fromStatus: string
    toStatus: string
    comment?: string | null
    createdAt?: Date | string
  }

  export type ClaimApprovalCreateManyUserInput = {
    id?: string
    itemId: string
    role: string
    createdAt?: Date | string
  }

  export type RequestAttachmentCreateManyUploadedByInput = {
    id?: string
    requestId: string
    itemId?: string | null
    fileName: string
    filePath: string
    fileSize: number
    mimeType: string
    claimDept?: string | null
    createdAt?: Date | string
  }

  export type AirRequestUpdateWithoutCreatedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
    items?: AirRequestItemUpdateManyWithoutRequestNestedInput
    approvalLogs?: ApprovalLogUpdateManyWithoutRequestNestedInput
    attachments?: RequestAttachmentUpdateManyWithoutRequestNestedInput
    hawbGroups?: HawbGroupUpdateManyWithoutRequestNestedInput
  }

  export type AirRequestUncheckedUpdateWithoutCreatedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
    items?: AirRequestItemUncheckedUpdateManyWithoutRequestNestedInput
    approvalLogs?: ApprovalLogUncheckedUpdateManyWithoutRequestNestedInput
    attachments?: RequestAttachmentUncheckedUpdateManyWithoutRequestNestedInput
    hawbGroups?: HawbGroupUncheckedUpdateManyWithoutRequestNestedInput
  }

  export type AirRequestUncheckedUpdateManyWithoutCreatedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    documentNo?: StringFieldUpdateOperationsInput | string
    brandName?: StringFieldUpdateOperationsInput | string
    buName?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    airline?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpMer?: NullableStringFieldUpdateOperationsInput | string | null
    vpMerToken?: NullableStringFieldUpdateOperationsInput | string | null
    presidentToken?: NullableStringFieldUpdateOperationsInput | string | null
    scmToken?: NullableStringFieldUpdateOperationsInput | string | null
    vpScmToken?: NullableStringFieldUpdateOperationsInput | string | null
    assignedVpScm?: NullableStringFieldUpdateOperationsInput | string | null
    logisticsToken?: NullableStringFieldUpdateOperationsInput | string | null
    accountingToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextEmail?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextToken?: NullableStringFieldUpdateOperationsInput | string | null
    claimNextName?: NullableStringFieldUpdateOperationsInput | string | null
    bu?: StringFieldUpdateOperationsInput | string
  }

  export type ApprovalLogUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    fromStatus?: StringFieldUpdateOperationsInput | string
    toStatus?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    request?: AirRequestUpdateOneRequiredWithoutApprovalLogsNestedInput
  }

  export type ApprovalLogUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    fromStatus?: StringFieldUpdateOperationsInput | string
    toStatus?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ApprovalLogUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    fromStatus?: StringFieldUpdateOperationsInput | string
    toStatus?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClaimApprovalUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    item?: AirRequestItemUpdateOneRequiredWithoutClaimApprovalsNestedInput
  }

  export type ClaimApprovalUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    itemId?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClaimApprovalUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    itemId?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RequestAttachmentUpdateWithoutUploadedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    itemId?: NullableStringFieldUpdateOperationsInput | string | null
    fileName?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileSize?: IntFieldUpdateOperationsInput | number
    mimeType?: StringFieldUpdateOperationsInput | string
    claimDept?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    request?: AirRequestUpdateOneRequiredWithoutAttachmentsNestedInput
  }

  export type RequestAttachmentUncheckedUpdateWithoutUploadedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    itemId?: NullableStringFieldUpdateOperationsInput | string | null
    fileName?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileSize?: IntFieldUpdateOperationsInput | number
    mimeType?: StringFieldUpdateOperationsInput | string
    claimDept?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RequestAttachmentUncheckedUpdateManyWithoutUploadedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    itemId?: NullableStringFieldUpdateOperationsInput | string | null
    fileName?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileSize?: IntFieldUpdateOperationsInput | number
    mimeType?: StringFieldUpdateOperationsInput | string
    claimDept?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AirRequestItemCreateManyRequestInput = {
    id?: string
    hawbGroupId?: string | null
    style: string
    so: string
    sub?: string | null
    customerPO?: string | null
    description?: string | null
    gmtType?: string | null
    originalShipmentDate?: Date | string | null
    planShipmentDate?: Date | string | null
    qtyOriginalShipment: number
    qtyRequestAir: number
    itemStatus?: string
    itemComment?: string | null
    reasonDelay: string
    factory: string
    country: string
    port: string
    grossWeight?: number | null
    airFreight?: number | null
    marketRatePerKg?: number | null
    actualAirFreight?: number | null
    claimDepartment?: string | null
    invoiceNo?: string | null
    hawbNo?: string | null
    bookingDate?: Date | string | null
    assignedDvm?: string | null
    claimPercentage?: number | null
    qtyActualShip?: number | null
  }

  export type ApprovalLogCreateManyRequestInput = {
    id?: string
    userId: string
    action: string
    fromStatus: string
    toStatus: string
    comment?: string | null
    createdAt?: Date | string
  }

  export type RequestAttachmentCreateManyRequestInput = {
    id?: string
    itemId?: string | null
    uploadedById: string
    fileName: string
    filePath: string
    fileSize: number
    mimeType: string
    claimDept?: string | null
    createdAt?: Date | string
  }

  export type HawbGroupCreateManyRequestInput = {
    id?: string
    hawbNo: string
    totalCharge: number
    createdAt?: Date | string
  }

  export type AirRequestItemUpdateWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    style?: StringFieldUpdateOperationsInput | string
    so?: StringFieldUpdateOperationsInput | string
    sub?: NullableStringFieldUpdateOperationsInput | string | null
    customerPO?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    gmtType?: NullableStringFieldUpdateOperationsInput | string | null
    originalShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    qtyOriginalShipment?: IntFieldUpdateOperationsInput | number
    qtyRequestAir?: IntFieldUpdateOperationsInput | number
    itemStatus?: StringFieldUpdateOperationsInput | string
    itemComment?: NullableStringFieldUpdateOperationsInput | string | null
    reasonDelay?: StringFieldUpdateOperationsInput | string
    factory?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    grossWeight?: NullableFloatFieldUpdateOperationsInput | number | null
    airFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    marketRatePerKg?: NullableFloatFieldUpdateOperationsInput | number | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    hawbNo?: NullableStringFieldUpdateOperationsInput | string | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedDvm?: NullableStringFieldUpdateOperationsInput | string | null
    claimPercentage?: NullableFloatFieldUpdateOperationsInput | number | null
    qtyActualShip?: NullableIntFieldUpdateOperationsInput | number | null
    hawbGroup?: HawbGroupUpdateOneWithoutItemsNestedInput
    claimApprovals?: ClaimApprovalUpdateManyWithoutItemNestedInput
  }

  export type AirRequestItemUncheckedUpdateWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    hawbGroupId?: NullableStringFieldUpdateOperationsInput | string | null
    style?: StringFieldUpdateOperationsInput | string
    so?: StringFieldUpdateOperationsInput | string
    sub?: NullableStringFieldUpdateOperationsInput | string | null
    customerPO?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    gmtType?: NullableStringFieldUpdateOperationsInput | string | null
    originalShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    qtyOriginalShipment?: IntFieldUpdateOperationsInput | number
    qtyRequestAir?: IntFieldUpdateOperationsInput | number
    itemStatus?: StringFieldUpdateOperationsInput | string
    itemComment?: NullableStringFieldUpdateOperationsInput | string | null
    reasonDelay?: StringFieldUpdateOperationsInput | string
    factory?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    grossWeight?: NullableFloatFieldUpdateOperationsInput | number | null
    airFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    marketRatePerKg?: NullableFloatFieldUpdateOperationsInput | number | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    hawbNo?: NullableStringFieldUpdateOperationsInput | string | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedDvm?: NullableStringFieldUpdateOperationsInput | string | null
    claimPercentage?: NullableFloatFieldUpdateOperationsInput | number | null
    qtyActualShip?: NullableIntFieldUpdateOperationsInput | number | null
    claimApprovals?: ClaimApprovalUncheckedUpdateManyWithoutItemNestedInput
  }

  export type AirRequestItemUncheckedUpdateManyWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    hawbGroupId?: NullableStringFieldUpdateOperationsInput | string | null
    style?: StringFieldUpdateOperationsInput | string
    so?: StringFieldUpdateOperationsInput | string
    sub?: NullableStringFieldUpdateOperationsInput | string | null
    customerPO?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    gmtType?: NullableStringFieldUpdateOperationsInput | string | null
    originalShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    qtyOriginalShipment?: IntFieldUpdateOperationsInput | number
    qtyRequestAir?: IntFieldUpdateOperationsInput | number
    itemStatus?: StringFieldUpdateOperationsInput | string
    itemComment?: NullableStringFieldUpdateOperationsInput | string | null
    reasonDelay?: StringFieldUpdateOperationsInput | string
    factory?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    grossWeight?: NullableFloatFieldUpdateOperationsInput | number | null
    airFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    marketRatePerKg?: NullableFloatFieldUpdateOperationsInput | number | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    hawbNo?: NullableStringFieldUpdateOperationsInput | string | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedDvm?: NullableStringFieldUpdateOperationsInput | string | null
    claimPercentage?: NullableFloatFieldUpdateOperationsInput | number | null
    qtyActualShip?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type ApprovalLogUpdateWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    fromStatus?: StringFieldUpdateOperationsInput | string
    toStatus?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutApprovalsNestedInput
  }

  export type ApprovalLogUncheckedUpdateWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    fromStatus?: StringFieldUpdateOperationsInput | string
    toStatus?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ApprovalLogUncheckedUpdateManyWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    fromStatus?: StringFieldUpdateOperationsInput | string
    toStatus?: StringFieldUpdateOperationsInput | string
    comment?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RequestAttachmentUpdateWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    itemId?: NullableStringFieldUpdateOperationsInput | string | null
    fileName?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileSize?: IntFieldUpdateOperationsInput | number
    mimeType?: StringFieldUpdateOperationsInput | string
    claimDept?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    uploadedBy?: UserUpdateOneRequiredWithoutAttachmentsNestedInput
  }

  export type RequestAttachmentUncheckedUpdateWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    itemId?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedById?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileSize?: IntFieldUpdateOperationsInput | number
    mimeType?: StringFieldUpdateOperationsInput | string
    claimDept?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RequestAttachmentUncheckedUpdateManyWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    itemId?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedById?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileSize?: IntFieldUpdateOperationsInput | number
    mimeType?: StringFieldUpdateOperationsInput | string
    claimDept?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HawbGroupUpdateWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    hawbNo?: StringFieldUpdateOperationsInput | string
    totalCharge?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    items?: AirRequestItemUpdateManyWithoutHawbGroupNestedInput
  }

  export type HawbGroupUncheckedUpdateWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    hawbNo?: StringFieldUpdateOperationsInput | string
    totalCharge?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    items?: AirRequestItemUncheckedUpdateManyWithoutHawbGroupNestedInput
  }

  export type HawbGroupUncheckedUpdateManyWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    hawbNo?: StringFieldUpdateOperationsInput | string
    totalCharge?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AirRequestItemCreateManyHawbGroupInput = {
    id?: string
    requestId: string
    style: string
    so: string
    sub?: string | null
    customerPO?: string | null
    description?: string | null
    gmtType?: string | null
    originalShipmentDate?: Date | string | null
    planShipmentDate?: Date | string | null
    qtyOriginalShipment: number
    qtyRequestAir: number
    itemStatus?: string
    itemComment?: string | null
    reasonDelay: string
    factory: string
    country: string
    port: string
    grossWeight?: number | null
    airFreight?: number | null
    marketRatePerKg?: number | null
    actualAirFreight?: number | null
    claimDepartment?: string | null
    invoiceNo?: string | null
    hawbNo?: string | null
    bookingDate?: Date | string | null
    assignedDvm?: string | null
    claimPercentage?: number | null
    qtyActualShip?: number | null
  }

  export type AirRequestItemUpdateWithoutHawbGroupInput = {
    id?: StringFieldUpdateOperationsInput | string
    style?: StringFieldUpdateOperationsInput | string
    so?: StringFieldUpdateOperationsInput | string
    sub?: NullableStringFieldUpdateOperationsInput | string | null
    customerPO?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    gmtType?: NullableStringFieldUpdateOperationsInput | string | null
    originalShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    qtyOriginalShipment?: IntFieldUpdateOperationsInput | number
    qtyRequestAir?: IntFieldUpdateOperationsInput | number
    itemStatus?: StringFieldUpdateOperationsInput | string
    itemComment?: NullableStringFieldUpdateOperationsInput | string | null
    reasonDelay?: StringFieldUpdateOperationsInput | string
    factory?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    grossWeight?: NullableFloatFieldUpdateOperationsInput | number | null
    airFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    marketRatePerKg?: NullableFloatFieldUpdateOperationsInput | number | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    hawbNo?: NullableStringFieldUpdateOperationsInput | string | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedDvm?: NullableStringFieldUpdateOperationsInput | string | null
    claimPercentage?: NullableFloatFieldUpdateOperationsInput | number | null
    qtyActualShip?: NullableIntFieldUpdateOperationsInput | number | null
    request?: AirRequestUpdateOneRequiredWithoutItemsNestedInput
    claimApprovals?: ClaimApprovalUpdateManyWithoutItemNestedInput
  }

  export type AirRequestItemUncheckedUpdateWithoutHawbGroupInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    style?: StringFieldUpdateOperationsInput | string
    so?: StringFieldUpdateOperationsInput | string
    sub?: NullableStringFieldUpdateOperationsInput | string | null
    customerPO?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    gmtType?: NullableStringFieldUpdateOperationsInput | string | null
    originalShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    qtyOriginalShipment?: IntFieldUpdateOperationsInput | number
    qtyRequestAir?: IntFieldUpdateOperationsInput | number
    itemStatus?: StringFieldUpdateOperationsInput | string
    itemComment?: NullableStringFieldUpdateOperationsInput | string | null
    reasonDelay?: StringFieldUpdateOperationsInput | string
    factory?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    grossWeight?: NullableFloatFieldUpdateOperationsInput | number | null
    airFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    marketRatePerKg?: NullableFloatFieldUpdateOperationsInput | number | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    hawbNo?: NullableStringFieldUpdateOperationsInput | string | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedDvm?: NullableStringFieldUpdateOperationsInput | string | null
    claimPercentage?: NullableFloatFieldUpdateOperationsInput | number | null
    qtyActualShip?: NullableIntFieldUpdateOperationsInput | number | null
    claimApprovals?: ClaimApprovalUncheckedUpdateManyWithoutItemNestedInput
  }

  export type AirRequestItemUncheckedUpdateManyWithoutHawbGroupInput = {
    id?: StringFieldUpdateOperationsInput | string
    requestId?: StringFieldUpdateOperationsInput | string
    style?: StringFieldUpdateOperationsInput | string
    so?: StringFieldUpdateOperationsInput | string
    sub?: NullableStringFieldUpdateOperationsInput | string | null
    customerPO?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    gmtType?: NullableStringFieldUpdateOperationsInput | string | null
    originalShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planShipmentDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    qtyOriginalShipment?: IntFieldUpdateOperationsInput | number
    qtyRequestAir?: IntFieldUpdateOperationsInput | number
    itemStatus?: StringFieldUpdateOperationsInput | string
    itemComment?: NullableStringFieldUpdateOperationsInput | string | null
    reasonDelay?: StringFieldUpdateOperationsInput | string
    factory?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    port?: StringFieldUpdateOperationsInput | string
    grossWeight?: NullableFloatFieldUpdateOperationsInput | number | null
    airFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    marketRatePerKg?: NullableFloatFieldUpdateOperationsInput | number | null
    actualAirFreight?: NullableFloatFieldUpdateOperationsInput | number | null
    claimDepartment?: NullableStringFieldUpdateOperationsInput | string | null
    invoiceNo?: NullableStringFieldUpdateOperationsInput | string | null
    hawbNo?: NullableStringFieldUpdateOperationsInput | string | null
    bookingDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedDvm?: NullableStringFieldUpdateOperationsInput | string | null
    claimPercentage?: NullableFloatFieldUpdateOperationsInput | number | null
    qtyActualShip?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type ClaimApprovalCreateManyItemInput = {
    id?: string
    userId: string
    role: string
    createdAt?: Date | string
  }

  export type ClaimApprovalUpdateWithoutItemInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutClaimApprovalsNestedInput
  }

  export type ClaimApprovalUncheckedUpdateWithoutItemInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClaimApprovalUncheckedUpdateManyWithoutItemInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Aliases for legacy arg types
   */
    /**
     * @deprecated Use UserCountOutputTypeDefaultArgs instead
     */
    export type UserCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = UserCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use AirRequestCountOutputTypeDefaultArgs instead
     */
    export type AirRequestCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = AirRequestCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use HawbGroupCountOutputTypeDefaultArgs instead
     */
    export type HawbGroupCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = HawbGroupCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use AirRequestItemCountOutputTypeDefaultArgs instead
     */
    export type AirRequestItemCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = AirRequestItemCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use UserDefaultArgs instead
     */
    export type UserArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = UserDefaultArgs<ExtArgs>
    /**
     * @deprecated Use MasterBrandDefaultArgs instead
     */
    export type MasterBrandArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = MasterBrandDefaultArgs<ExtArgs>
    /**
     * @deprecated Use MasterBUDefaultArgs instead
     */
    export type MasterBUArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = MasterBUDefaultArgs<ExtArgs>
    /**
     * @deprecated Use MasterDescriptionDefaultArgs instead
     */
    export type MasterDescriptionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = MasterDescriptionDefaultArgs<ExtArgs>
    /**
     * @deprecated Use MasterGMTTypeDefaultArgs instead
     */
    export type MasterGMTTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = MasterGMTTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use MasterPortDefaultArgs instead
     */
    export type MasterPortArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = MasterPortDefaultArgs<ExtArgs>
    /**
     * @deprecated Use AirRequestDefaultArgs instead
     */
    export type AirRequestArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = AirRequestDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ClaimApprovalDefaultArgs instead
     */
    export type ClaimApprovalArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ClaimApprovalDefaultArgs<ExtArgs>
    /**
     * @deprecated Use HawbGroupDefaultArgs instead
     */
    export type HawbGroupArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = HawbGroupDefaultArgs<ExtArgs>
    /**
     * @deprecated Use AirRequestItemDefaultArgs instead
     */
    export type AirRequestItemArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = AirRequestItemDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ApprovalLogDefaultArgs instead
     */
    export type ApprovalLogArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ApprovalLogDefaultArgs<ExtArgs>
    /**
     * @deprecated Use RequestAttachmentDefaultArgs instead
     */
    export type RequestAttachmentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = RequestAttachmentDefaultArgs<ExtArgs>

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}