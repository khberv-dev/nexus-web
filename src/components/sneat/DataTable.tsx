"use client"
import {AgGridReact} from "ag-grid-react"
import {AllCommunityModule, ColDef, ModuleRegistry} from "ag-grid-community"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-quartz.css"

ModuleRegistry.registerModules([AllCommunityModule])

interface Props<T> {
    rowData: T[]
    columnDefs: ColDef<T>[]
    height?: number
}

export default function DataTable<T>({rowData, columnDefs, height = 400}: Props<T>) {
    return (
        <div className="ag-theme-quartz" style={{height}}>
            <AgGridReact rowData={rowData} columnDefs={columnDefs} pagination paginationPageSize={20}/>
        </div>
    )
}
