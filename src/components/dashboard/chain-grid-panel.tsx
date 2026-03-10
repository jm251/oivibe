"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { OptionChainRow } from "@/lib/types";

export function ChainGridPanel({ rows }: { rows: OptionChainRow[] }) {
  return (
    <Card className="flex h-full min-h-[360px] flex-col">
      <CardHeader>
        <CardTitle>Option Chain Grid</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <ScrollArea className="h-full pr-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Call LTP</TableHead>
                <TableHead>Call OI</TableHead>
                <TableHead>Call ?OI</TableHead>
                <TableHead className="text-center">Strike</TableHead>
                <TableHead>Put ?OI</TableHead>
                <TableHead>Put OI</TableHead>
                <TableHead>Put LTP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.strike}>
                  <TableCell>{row.call.ltp.toFixed(2)}</TableCell>
                  <TableCell>{Math.round(row.call.oi).toLocaleString("en-IN")}</TableCell>
                  <TableCell className={row.call.deltaOi >= 0 ? "text-bullish" : "text-bearish"}>
                    <span className="inline-flex items-center gap-1">
                      {row.call.deltaOi >= 0 ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      {Math.round(row.call.deltaOi).toLocaleString("en-IN")}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-semibold">{row.strike}</TableCell>
                  <TableCell className={row.put.deltaOi >= 0 ? "text-bullish" : "text-bearish"}>
                    <span className="inline-flex items-center gap-1">
                      {row.put.deltaOi >= 0 ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      {Math.round(row.put.deltaOi).toLocaleString("en-IN")}
                    </span>
                  </TableCell>
                  <TableCell>{Math.round(row.put.oi).toLocaleString("en-IN")}</TableCell>
                  <TableCell>{row.put.ltp.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
