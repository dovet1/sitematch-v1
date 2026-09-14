import { describedCommercialWork } from '../commercial-description'

const work = (description: string) => describedCommercialWork(description)?.work ?? null

describe('describedCommercialWork', () => {
  it('reads the Broadland warehouse club permission, which Plota\'s archive leaves unclassified', () => {
    expect(work('Erection of a Warehouse Club (Sui Generis) including, tyre installation and sales, a petrol filling station, deck and surface car parking, accesses, landscaping, engineering, and associated works.'))
      .toBe('new')
  })

  it.each([
    ['Change of use of warehouse unit to boxing gym', 'between'],
    ['Change of use from Class E(a) (Retail) to Class E(b) (sale of food and drink for consumption on the premises)', 'between'],
    ['Use of retail unit (Use Class A1) as a cafe (Use Class A3)', 'between'],
    ['Change of use from Class 3 (Food and Drink) to Hot Food Takeaway (Sui Generis)', 'between'],
    ['Change of use of existing garage from C3 (residential) to Sui Generis (motor vehicle repair garage)', 'to-commercial'],
    ['Change of use from a dwelling to a holiday let', 'to-commercial'],
    ['Retrospective change of use of premises to short-term let accommodation.', 'to-commercial'],
    ['Prior Approval for change of agricultural/horticultural buildings to storage use.', 'to-commercial'],
    ['Change of use of part of the ground floor commercial (Class E) to 1no. self-contained flat (Class C3)', 'loss'],
    ['Change of use from a hairdressing salon/commercial premises (Use Class E) into two self-contained residential flats (Use Class C3)', 'loss'],
    ['Prior approval pursuant to Schedule 2, Part 3, Paragraph MA for change of use from offices to 12 flats', 'loss'],
    ['Change of use to a mix of uses including offices (Class 4) and beauty/tattoo salon (sui-generis)', 'to-commercial'],
  ])('reads a change of use: "%s"', (description, expected) => {
    expect(work(description)).toBe(expected)
  })

  it.each([
    'Erection of 15No. light industrial / commercial units (2,050 sq.m.) with associated works',
    'Proposed 2no. light industrial (Class B2) units, roof-mounted solar panels, parking and access',
    'Installation of a hand car wash facility including canopy, screening and associated works',
    'Erection of New Storage and Maintenance Building - Extension of Existing Business',
    'Outline application for the erection of a part 3/part 6 storey micro hotel with up to 22 rooms',
    'To site seven 1-bedroom holiday cabins on the field adjacent to Oak Hill',
    'The restoration and extension of Victoria House to form a Starbucks Drive-Thru on the ground floor',
    'Request for EIA screening opinion for the proposed construction of a new poultry processing facility',
  ])('reads new commercial space: "%s"', (description) => {
    expect(work(description)).toBe('new')
  })

  it.each([
    ['a household garage conversion', 'Conversion of existing attached garage to office room; alterations to fenestration'],
    ['a garden gym', 'Erection of single storey detached outbuilding for use a Gym in the rear garden.'],
    ['a garage with a gym', 'Erection of garage with gym'],
    ['a householder extension adding an office', 'Single storey and partial two storey extension to the rear providing additional hallway, toilet, office and space'],
    ['an agricultural store', 'Construction of an agricultural hay storage building'],
    ['a shed-like storage building', 'Erection of detached metal frame storage unit'],
    ['minor works to a shop', 'Installation of a new shop front, including repair and repainting of external render'],
    ['signage for a hotel', 'Erection of signage for hotel development approved under planning permission LA04/2023/3442/F'],
    ['a Gypsy and Traveller site', 'Change of use of land to a travellers caravan site including the provision of a utility dayroom'],
    ['a certificate for an existing use', 'Certificate of lawfulness application for the existing use as a Gym (Use Class E)'],
    ['a condition submission quoting its parent', 'Details pursuant to condition 35 of planning application MC/23/2857 for the erection of retail units'],
    ['a variation quoting its parent', 'To vary conditions 27 and 28 attached to planning ref 25F/0270 (erection of a hotel)'],
    ['a neighbouring council\'s consultation', 'Consultation by Sevenoaks Borough Council (25/03335/LDCEX) Use of the existing building for Class E Use'],
    ['a school sports hall', 'Erection of a new educational block comprising sports facilities and 2 no. classrooms'],
    ['residents\' amenities in a housing scheme', 'Erection of mixed use building to form residential units with ancillary amenities including gymnasium, cinema'],
    ['a shopfront extension', 'Rear shop extension, and three new flats.'],
  ])('does not admit %s', (_case, description) => {
    expect(work(description)).toBeNull()
  })

  it('keeps the evidence that justified the reading', () => {
    expect(describedCommercialWork('Change of use from Shop Premises to a Bookmakers Premises')).toEqual({
      work: 'between', evidence: expect.stringContaining('Bookmakers'),
    })
  })
})
