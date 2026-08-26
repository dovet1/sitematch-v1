import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'design-system';

export function Default() {
  return (
    <Select>
      <SelectTrigger style={{ width: 240 }}>
        <SelectValue placeholder="Select a property type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="retail">Retail</SelectItem>
        <SelectItem value="office">Office</SelectItem>
        <SelectItem value="industrial">Industrial</SelectItem>
        <SelectItem value="leisure">Leisure</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function WithValueSelected() {
  return (
    <Select defaultValue="office">
      <SelectTrigger style={{ width: 240 }}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="retail">Retail</SelectItem>
        <SelectItem value="office">Office</SelectItem>
        <SelectItem value="industrial">Industrial</SelectItem>
        <SelectItem value="leisure">Leisure</SelectItem>
      </SelectContent>
    </Select>
  );
}
