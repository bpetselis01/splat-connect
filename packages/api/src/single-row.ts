// A .single() read fails two ways: no matching row (PGRST116), which is a 404,
// or the database failing (a timeout under load), which must not pass for one.
export const singleRowStatus = (error: { code?: string }) => (error.code === 'PGRST116' ? 404 : 500)
