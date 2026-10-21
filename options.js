// Shared Mongoose schema options.
//
// `strict: false` keeps fields the frontend owns but the schema does not
// declare (images, workLog, officer, isPublic, reporter…).
//
// The `toJSON` transform strips MongoDB internals so the API returns the
// plain document the browser app stores. Without it every response would
// carry `_id` / `__v`, and a later PATCH would try to write `_id` — which
// MongoDB rejects as an immutable-field update.
const schemaOptions = {
  timestamps: true,
  strict: false,
  toJSON: {
    virtuals: false,
    transform(doc, ret) {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
};

module.exports = { schemaOptions };
