/**
 * 示例填报数据索引
 * 包含5种不同学校类型的示例数据，可用于测试填报页面
 */

import primaryData from './sample-data-primary.json';
import juniorData from './sample-data-junior.json';
import nineYearData from './sample-data-nine-year.json';
import twelveYearData from './sample-data-twelve-year.json';
import completeSecondaryData from './sample-data-complete-secondary.json';
import districtBalanceData from './sample-data-district-balance.json';
import kindergartenData from './sample-data-kindergarten.json';
import countyKindergartenData from './sample-data-county-kindergarten.json';

export const sampleDataList = [
  {
    type: 'primary',
    label: '小学',
    description: '小学示例数据',
    data: primaryData,
  },
  {
    type: 'junior',
    label: '初中',
    description: '初中示例数据',
    data: juniorData,
  },
  {
    type: 'nine_year',
    label: '九年一贯制学校',
    description: '九年一贯制学校示例数据（小学部+初中部）',
    data: nineYearData,
  },
  {
    type: 'twelve_year',
    label: '十二年一贯制学校',
    description: '十二年一贯制学校示例数据（小学部+初中部+高中部）',
    data: twelveYearData,
  },
  {
    type: 'complete_secondary',
    label: '完全中学',
    description: '完全中学示例数据（初中部+高中部）',
    data: completeSecondaryData,
  },
  {
    type: 'district_balance',
    label: '区县优质均衡',
    description: '区县优质均衡示例数据',
    data: districtBalanceData,
  },
  {
    type: 'kindergarten',
    label: '幼儿园',
    description: '幼儿园示例数据',
    data: kindergartenData,
  },
  {
    type: 'county_kindergarten',
    label: '区县普及普惠',
    description: '区县普及普惠示例数据',
    data: countyKindergartenData,
  },
];

export { primaryData, juniorData, nineYearData, twelveYearData, completeSecondaryData, districtBalanceData, kindergartenData, countyKindergartenData };

export default sampleDataList;
