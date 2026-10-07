/**
 * Component: GraphControls (GraphLineOption)
 * ตัวเลือก Custom Option สำหรับ React-Select ในการเลือก Line กราฟ
 * - แสดงชื่อ Line พร้อมเครื่องหมายถูก (✓) เมื่อถูกเลือก
 */
import { components as selectComponents } from 'react-select';

export function GraphLineOption(props) {
  return (
    <selectComponents.Option {...props}>
      <div className="flex w-full items-center justify-between gap-3">
        <span>{props.label}</span>
        {props.isSelected && <span className="text-blue-600">✓</span>}
      </div>
    </selectComponents.Option>
  );
}
