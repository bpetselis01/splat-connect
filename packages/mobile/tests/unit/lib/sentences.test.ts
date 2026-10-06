import { sentences } from '../../../lib/sentences'

it('splits a step body at its sentence ends', () => {
  expect(sentences('Hold the switch in the jig. Test it: it should run only while pressed.')).toEqual([
    'Hold the switch in the jig.',
    'Test it: it should run only while pressed.',
  ])
})

it('keeps decimals, lowercase continuations and a single sentence whole', () => {
  expect(sentences('Use a 3.5 mm plug, e.g. the mono one.')).toEqual(['Use a 3.5 mm plug, e.g. the mono one.'])
  expect(sentences('No stop at all')).toEqual(['No stop at all'])
})

it('splits before a number and after ! or ?', () => {
  expect(sentences('Ready? 2 screws go in! Then close it.')).toEqual(['Ready?', '2 screws go in!', 'Then close it.'])
})

it('returns nothing for an empty body', () => {
  expect(sentences('   ')).toEqual([])
})
